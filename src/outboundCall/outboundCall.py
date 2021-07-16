import json
import boto3
import os
import wave
import datetime
from contextlib import closing
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport
import time


chime = boto3.client('chime')
dynamodb = boto3.client('dynamodb')
outgoingWavBucket = os.environ['OUTGOING_WAV_BUCKET']
sipMediaApplicationId = os.environ['SMA_ID']
fromNumber = os.environ['FROM_NUMBER']
requesterTable = os.environ['REQUESTER_TABLE_NAME']
polly = boto3.client('polly')

reqHeaders = {
    'x-api-key' : os.environ['API_KEY'],
    'Authorization': 'Bearer ' + os.environ['API_KEY']
}

transport = RequestsHTTPTransport(url=os.environ['API_URL'], headers = reqHeaders, verify=True, retries=3)

client = Client(transport=transport, fetch_schema_from_transport=True)

query =  gql(
    """
    mutation UpdateNote($note: UpdateNoteInput!) {
        updateNote(note: $note) {
            id
            lastName
            firstName
            phoneNumber
            status
            message
            transactionId
        }
    }
"""
)


def createPolly (pollyText, transactionId):
    response = polly.synthesize_speech(
        OutputFormat='pcm',
        Text = pollyText,
        SampleRate = '8000',
        VoiceId = 'Joanna'
    )
    
    if "AudioStream" in response:
        outputWav = transactionId + '.wav'
        with wave.open('/tmp/' + outputWav, 'wb') as wav_file:
            wav_file.setparams((1, 2, 8000, 0, 'NONE', 'NONE'))
            wav_file.writeframes(response['AudioStream'].read())
    
    return outputWav
    
def uploadWav(wavFile):
    s3 = boto3.client('s3')
    s3.upload_file('/tmp/' + wavFile, 
      outgoingWavBucket, 
      wavFile,
      ExtraArgs = {'ContentType': 'audio/wav'})

    return 


def queryTable (id):
    response = dynamodb.get_item(
        TableName=requesterTable,
        Key={
            'id': {'S': id}
        }
    )
    return response['Item']


def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        print(body)
        
    except:
        print('queryStringParameters is None')
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps('None')
        }
    
    id = body['id']
    for x in id:
        requester = queryTable(x)
        appointmentInfo = {
            'phoneNumber' : requester['phoneNumber']['S'],
            'firstName' : requester['firstName']['S'],
            'lastName' : requester['lastName']['S'],
            'message' : requester['message']['S']
        }
        response = chime.create_sip_media_application_call(
            FromPhoneNumber=fromNumber,
            ToPhoneNumber=appointmentInfo['phoneNumber'],
            SipMediaApplicationId=sipMediaApplicationId
        )
        print("Sending Call: " + str(response))
        transactionId = response['SipMediaApplicationCall']['TransactionId']
        params = { 
            "note" : {
                "id" : x,
                'phoneNumber' : requester['phoneNumber']['S'],
                'firstName' : requester['firstName']['S'],
                'lastName' : requester['lastName']['S'],
                'message' : requester['message']['S'],        
                "transactionId" : transactionId,
                "status" : "Calling User"
            }
        }
        result = client.execute(query, variable_values=params)

        pollyText = 'This message is for ' + appointmentInfo['firstName'] + ' ' + appointmentInfo['lastName'] + '. ' + appointmentInfo['message']
        wavFile = createPolly(pollyText, transactionId)
        uploadWav(wavFile)
        time.sleep(1)

    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST'
        },
        'body': json.dumps('Success')
    }
