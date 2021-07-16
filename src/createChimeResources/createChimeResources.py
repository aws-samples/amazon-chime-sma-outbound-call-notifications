import boto3
import time

chime = boto3.client('chime')

def getPhoneNumber (state):
  search_response = chime.search_available_phone_numbers(
      # AreaCode='string',
      # City='string',
      # Country='string',
      State=state,
      # TollFreePrefix='string',
      MaxResults=1
  )
  phoneNumberToOrder = search_response['E164PhoneNumbers'][0]
  print ('Phone Number: ' + phoneNumberToOrder)
  phone_order = chime.create_phone_number_order(
      ProductType='SipMediaApplicationDialIn',
      E164PhoneNumbers=[
          phoneNumberToOrder,
      ]
  )
  print ('Phone Order: ' + str(phone_order))

  check_phone_order = chime.get_phone_number_order(
    PhoneNumberOrderId=phone_order['PhoneNumberOrder']['PhoneNumberOrderId']
  )
  order_status = check_phone_order['PhoneNumberOrder']['Status']
  timeout = 0

  while not order_status == 'Successful':
    timeout += 1  
    print('Checking status: ' + str(order_status))
    time.sleep(5)
    check_phone_order = chime.get_phone_number_order(
      PhoneNumberOrderId=phone_order['PhoneNumberOrder']['PhoneNumberOrderId']
    )
    order_status = check_phone_order['PhoneNumberOrder']['Status']
    if timeout == 5:
      return 'Could not get phone'

  return phoneNumberToOrder

def createSMA (region, name, lambdaArn):
  sma_create_response = chime.create_sip_media_application(
    AwsRegion=region,
    Name=name+'-SMA',
    Endpoints=[
        {
            'LambdaArn': lambdaArn
        },
    ]
  )

  print ('sma create: ' + str(sma_create_response))

  return sma_create_response['SipMediaApplication']['SipMediaApplicationId']

def on_event(event, context):
  print(event)
  request_type = event['RequestType']
  if request_type == 'Create': return on_create(event)
  if request_type == 'Update': return on_update(event)
  if request_type == 'Delete': return on_delete(event)
  raise Exception("Invalid request type: %s" % request_type)

def on_create(event):
  physical_id = 'smaResources'
  region = event['ResourceProperties']['region']
  name = event['ResourceProperties']['smaName']
  lambdaArn = event['ResourceProperties']['lambdaArn']
  phoneNumberRequired = event['ResourceProperties']['phoneNumberRequired']
  state = event['ResourceProperties']['state']

  print(phoneNumberRequired)

  if phoneNumberRequired == 'true':
    newPhoneNumber = getPhoneNumber(state)

  smaID = createSMA(region, name, lambdaArn)

  if phoneNumberRequired == 'true':
    createSMAResponse = { 'smaID': smaID, 'phoneNumber': newPhoneNumber}
  else:
    createSMAResponse = { 'smaID': smaID }

  return { 'PhysicalResourceId': physical_id, 'Data': createSMAResponse }

def on_update(event):
  physical_id = event["PhysicalResourceId"]
  props = event["ResourceProperties"]
  print("update resource %s with props %s" % (physical_id, props))
  return { 'PhysicalResourceId': physical_id }  


def on_delete(event):
  physical_id = event["PhysicalResourceId"]
  print("delete resource %s" % physical_id)
  return { 'PhysicalResourceId': physical_id }