const AWS = require('aws-sdk');
const axios = require('axios');
const gql = require('graphql-tag');
const graphql = require('graphql');
const { print } = graphql;

const updateNote = gql`
    mutation UpdateNote($note: UpdateNoteInput!) {
        updateNote(note: $note) {
          id
          lastName
          firstName
          phoneNumber
          status
          message     
        }
    }
`;

const getNotebyTransactionId = gql`
  query getNotebyTransactionId($transactionId: String!) {
    getNotebyTransactionId (transactionId: $transactionId) {
      id
      lastName
      firstName
      phoneNumber
      status
      message      
    }
  }
`;


async function update (details, status) {
    const note = {
        id: details.id,
        firstName: details.firstName,
        lastName: details.lastName,
        message: details.message,
        phoneNumber: details.phoneNumber,
        status: status
    }
   
   console.log(`Updating Dynamo: ${JSON.stringify(note, null, 2)}`)
   try {
       const graphqlData = await axios({
            url: process.env.API_URL,
            method: 'post',
            headers: {
                'x-api-key': process.env.API_KEY
            },
            data: {
                query: print(updateNote),
                variables: {
                    note
                }
            }
        });
        return graphqlData.data
   } catch (err) {
       console.log(err)
       return null
   }
}

async function query(transactionId) {
    console.log(`Querying using transactionId: ${transactionId}`);

    const graphqlData = await axios({
        url: process.env.API_URL,
        method: 'post',
        headers: {
            'x-api-key': process.env.API_KEY
        },
        data: {
            query: print(getNotebyTransactionId),
            variables: {
                transactionId
            }
        }
    });

    return graphqlData.data.data.getNotebyTransactionId
}

exports.handler = async(event, context, callback) => {
    console.log("Lambda is invoked with calldetails:" + JSON.stringify(event));
    let actions;
    const details = await query(event.CallDetails.TransactionId)
    switch (event.InvocationEventType) {

        case "ACTION_SUCCESSFUL":
            console.log("SUCCESS ACTION");
            actions = await actionSuccessful(event, details);
            break;

        case "ACTION_FAILED":
            console.log("FAILED ACTION");
            actions = await actionFailed(event, details);
            break;

        case "HANGUP":
            console.log("HANGUP ACTION");
            if (event.CallDetails.Participants[0].Status === "Disconnected") {
            }
            actions = [];
            break;
            
        case "NEW_OUTBOUND_CALL":
            console.log("OUTBOUND");
            break;
        
        case "RINGING":
            console.log("RINGING")
            var updatedDatabase = await update(details, "Ringing")
            break;

         case "CALL_ANSWERED":
            console.log("ANSWERED");
            actions = await newCall(event, details);
            break;           

        default:
            console.log("FAILED ACTION");
            actions = await newCall(event, details);
    }

    const response = {
        "SchemaVersion": "1.0",
        "Actions": actions
    };

    console.log("Sending response:" + JSON.stringify(response));

    callback(null, response);
}

async function newCall(event, details) {
    const transactionId = event.CallDetails.TransactionId;
    var updatedDatabase = await update(details, "Call Answered")
    playAudioAction.Parameters.AudioSource.Key = transactionId + '.wav';
    playAudioAndGetDigitsAction.Parameters.AudioSource.Key = 'requestResponse.wav'
    return [pauseAction, playAudioAction, playAudioAndGetDigitsAction];
}

async function actionSuccessful(event, details) {
    console.log("ACTION_SUCCESSFUL");
    
    switch (event.ActionData.Type) {
        case "PlayAudioAndGetDigits":
            if (event.ActionData.ReceivedDigits === "1") {
                await update(details, "Appointment Confirmed")
                playAudioAction.Parameters.AudioSource.Key = 'confirmed.wav';
                return [playAudioAction, hangupAction]
            } else if (event.ActionData.ReceivedDigits === "2") {
                await update(details, "Appointment Rejected")
                playAudioAction.Parameters.AudioSource.Key = 'rejected.wav';
                return [playAudioAction, hangupAction]
            } else {
                console.log("Recieved Other")
                return []
            }

        case "PlayAudio":
            return [];

        default:
            return [];
    }
}

async function actionFailed(event, details) {
    console.log("ACTION_FAILED");
    console.log("ActionDataType: " + event.ActionData.Type)
    switch (event.ActionData.Type) {
        case "PlayAudioAndGetDigits":
            await update(details, "No Response")
            return []

        default:
            return [];
    }
}

const pauseAction = {
    "Type": "Pause",
    "Parameters": {
        "DurationInMilliseconds": "1000"
    }
};

const hangupAction = {
    "Type": "Hangup",
    "Parameters": {
        "SipResponseCode": "0"
    }
};

const playAudioAction = {
    "Type": "PlayAudio",
    "Parameters": {
        "ParticipantTag": "LEG-A",
        "AudioSource": {
            "Type": "S3",
            "BucketName": process.env.OUTGOING_WAV_BUCKET,
            "Key": ""
        }
    }
};

const playAudioAndGetDigitsAction = {
    "Type": "PlayAudioAndGetDigits",
    "Parameters": {
        "MinNumberOfDigits": 1,
        "MaxNumberOfDigits": 1,
        "InputDigitsRegex": "^[12]$",
        "Repeat": 3,
        "InBetweenDigitsDurationInMilliseconds": 2000,
        "RepeatDurationInMilliseconds": 15000,
        "TerminatorDigits": ["#"],
        "AudioSource": {
            "Type": "S3",
            "BucketName": process.env.OUTGOING_WAV_BUCKET,
            "Key": ""
        },
        "FailureAudioSource": {
            "Type": "S3",
            "BucketName": process.env.OUTGOING_WAV_BUCKET,
            "Key": "failure.wav"
        }
    }
};