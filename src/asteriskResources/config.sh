#!/bin/bash -xe
HOMEDIR=/home/ec2-user
yum update -y
yum install net-tools -y
yum install wget -y
amazon-linux-extras install epel -y
yum -y install make gcc gcc-c++ make subversion libxml2-devel ncurses-devel openssl-devel vim-enhanced man glibc-devel autoconf libnewt kernel-devel kernel-headers linux-headers openssl-devel zlib-devel libsrtp libsrtp-devel uuid libuuid-devel mariadb-server jansson-devel libsqlite3x libsqlite3x-devel epel-release.noarch bash-completion bash-completion-extras unixODBC unixODBC-devel libtool-ltdl libtool-ltdl-devel mysql-connector-odbc mlocate libiodbc sqlite sqlite-devel sql-devel.i686 sqlite-doc.noarch sqlite-tcl.x86_64 patch libedit-devel jq

cd /tmp
wget https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-16-current.tar.gz
tar xvzf asterisk-16-current.tar.gz 
cd asterisk-16*/
./configure --libdir=/usr/lib64 --with-jansson-bundled
make menuselect.makeopts
menuselect/menuselect \
        --disable BUILD_NATIVE \
        --disable chan_sip \
        --disable chan_skinny \
        --enable cdr_csv \
        --enable res_snmp \
        --enable res_http_websocket \
        menuselect.makeopts
make 
make install
make basic-pbx
touch /etc/redhat-release
make config
ldconfig

IP=$( curl http://169.254.169.254/latest/meta-data/public-ipv4 )
REGION=$( curl http://169.254.169.254/latest/meta-data/placement/region )
PhoneNumber=$( aws ssm get-parameter --name /asterisk/phoneNumber --region $REGION | jq -r '.Parameter.Value' )
VoiceConnectorHost=$( aws ssm get-parameter --name /asterisk/voiceConnector --region $REGION | jq -r '.Parameter.Value' )
OutboundHostName=$( aws ssm get-parameter --name /asterisk/outboundHostName --region $REGION | jq -r '.Parameter.Value' )


echo "[udp]
type=transport
protocol=udp
bind=0.0.0.0
external_media_address=$IP
external_signaling_address=$IP
allow_reload=yes

[VoiceConnector]
type=endpoint
context=from-voiceConnector
transport=udp
disallow=all
allow=ulaw
aors=VoiceConnector
direct_media=no
ice_support=yes
force_rport=yes

[VoiceConnector]
type=identify
endpoint=VoiceConnector
match=$OutboundHostName

[VoiceConnector]
type=aor
contact=sip:$OutboundHostName

[$PhoneNumber]
type=endpoint
context=from-phone
disallow=all
allow=ulaw
transport=udp
auth=$PhoneNumber
aors=$PhoneNumber
send_pai=yes
direct_media=no
rewrite_contact=yes
ice_support=yes
force_rport=yes

[$PhoneNumber]
type=auth
auth_type=userpass
password=ChimeDemo
username=$PhoneNumber

[$PhoneNumber]
type=aor
max_contacts=5" > /etc/asterisk/pjsip.conf

echo "; extensions.conf - the Asterisk dial plan
;
[general]
static=yes
writeprotect=no
clearglobalvars=no

[from-voiceConnector]
include => phones

[phones]
exten => $PhoneNumber, 1,NoOp(Inbound Call)
same  => n, Set(reject=\${RAND(1,10)})
same  => n, GoToIf(\$[\${reject} > 8]?reject:answer)
same  => n(reject), NoOp(Reject Call)
same  => n, Answer()
same  => n, Wait(2)
same  => n, Hangup()
same  => n(answer), NoOp(Answer Call)
same  => n, Answer()
same  => n, Wait(\${RAND(5,15)})
same  => n, SendDTMF(\${RAND(1,2)})
same  => n, Wait(1)
same  => n, Hangup()" > /etc/asterisk/extensions.conf

echo "[options]
runuser = asterisk
rungroup = asterisk" > /etc/asterisk/asterisk.conf

echo "[general]
[logfiles]
console = verbose,notice,warning,error
messages = notice,warning,error" > /etc/asterisk/logger.conf

echo "load = func_rand.so
load = app_senddtmf.so" >> /etc/asterisk/modules.conf

groupadd asterisk
useradd -r -d /var/lib/asterisk -g asterisk asterisk
usermod -aG audio,dialout asterisk
chown -R asterisk.asterisk /etc/asterisk
chown -R asterisk.asterisk /var/{lib,log,spool}/asterisk

systemctl start asterisk
