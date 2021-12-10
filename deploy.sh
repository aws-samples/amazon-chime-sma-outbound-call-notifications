 #!/bin/bash
while getopts o: flag
do
    case "${flag}" in
        o) options=${OPTARG};;
    esac
done
echo "Options: $options";

if ! [ -x "$(command -v node)" ]; then
  echo 'Error: node is not installed.' >&2
  exit 1
fi
NODEVER="$(node --version)"
REQNODE="v12.0.0"
if ! [ "$(printf '%s\n' "$REQNODE" "$NODEVER" | sort -V | head -n1)" = "$REQNODE" ]; then 
    echo 'node must be version 12+'
    exit 1
fi
if ! [ -x "$(command -v npm)" ]; then
  echo 'Error: npm is not installed.' >&2
  exit 1
fi
if ! [ -x "$(command -v aws)" ]; then
  echo 'Error: aws is not installed.' >&2
  exit 1
fi
if ! [ -x "$(command -v python3)" ]; then
  echo 'Error: python3 is not installed.' >&2
  exit 1
fi
if ! [[ -x "$(command -v pip)" || -x "$(command -v pip3)" ]]; then
  echo 'Error: pip/pip3 is not installed.' >&2
  exit 1
fi
if [ -f "cdk.context.json" ]; then
    echo ""
    echo "INFO: Removing cdk.context.json"
    rm cdk.context.json
else
    echo ""
    echo "INFO: cdk.context.json not present, nothing to remove"
fi
if [ ! -f "yarn.lock" ]; then
    echo ""
    echo "Installing Packages"
    echo ""
    yarn
fi
echo ""
echo "Building CDK"
echo ""
yarn run build
echo ""
echo "Bootstrapping CDK"
echo ""
yarn cdk bootstrap
echo ""
echo "Building Packages"
echo ""
INSTALLED=false
pushd src/python_layer/python/lib/python3.8
if [ $(command -v pip3) ]; then 
    echo "pip3 found\n"
    pip3 install --target site-packages -r requirements.txt
    INSTALLED=true
fi
if [ $(command -v pip) ] && [ "$INSTALLED" = "false" ]; then
    printf "pip found\n"
    pip install --target site-packages -r requirements.txt
fi
popd
pushd src/smaOutbound
yarn
popd
echo ""
echo "Deploying CDK"
echo ""
yarn cdk deploy SMANotification -O client-app/src/cdk-outputs.json
if [ "$options" = "withAsterisk" ]; then
    printf "Deploying Asterisk\n"
    yarn cdk deploy AsteriskEndpoint -O client-app/src/asterisk-outputs.json
    pushd utils
    echo ""
    echo "Installing Packages"
    echo ""
    yarn
    node createCsv.js
    popd
fi

