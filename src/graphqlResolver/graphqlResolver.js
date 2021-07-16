"use strict";
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

async function createNote(note) {
    const params = {
        TableName: process.env.NOTES_TABLE,
        Item: note
    };
    try {
        await docClient.put(params).promise();
        return note;
    }
    catch (err) {
        console.log('DynamoDB error: ', err);
        return null;
    }
}

async function deleteNote(noteId) {
    const params = {
        TableName: process.env.NOTES_TABLE,
        Key: {
            id: noteId
        }
    };
    try {
        await docClient.delete(params).promise();
        return noteId;
    }
    catch (err) {
        console.log('DynamoDB error: ', err);
        return null;
    }
}

async function getNoteById(noteId) {
    const params = {
        TableName: process.env.NOTES_TABLE,
        Key: { id: noteId }
    };
    try {
        const { Item } = await docClient.get(params).promise();
        return Item;
    }
    catch (err) {
        console.log('DynamoDB error: ', err);
    }
}

async function getNotebyTransactionId(transactionId) {
    const params = {
        TableName: process.env.NOTES_TABLE,
        IndexName: 'transactionId-index',
        KeyConditionExpression: 'transactionId = :t',
        ExpressionAttributeValues: { ':t': transactionId }
    };
    console.log(params)
    try {
        const { Items } = await docClient.query(params).promise();
        console.log(Items[0])
        return Items[0] ;
    }
    catch (err) {
        console.log('DynamoDB error: ', err);
    }
}

async function listNotes() {
    const params = {
        TableName: process.env.NOTES_TABLE,
    };
    try {
        const data = await docClient.scan(params).promise();
        return data.Items;
    }
    catch (err) {
        console.log('DynamoDB error: ', err);
        return null;
    }
}

async function updateNote(note) {
    let params = {
        TableName: process.env.NOTES_TABLE,
        Key: {
            id: note.id
        },
        ExpressionAttributeValues: {},
        ExpressionAttributeNames: {},
        UpdateExpression: "",
        ReturnValues: "UPDATED_NEW"
    };
    console.log(`Updating Note: ${JSON.stringify(params, null, 2)}`)
    let prefix = "set ";
    let attributes = Object.keys(note);
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        if (attribute !== "id") {
            params["UpdateExpression"] += prefix + "#" + attribute + " = :" + attribute;
            params["ExpressionAttributeValues"][":" + attribute] = note[attribute];
            params["ExpressionAttributeNames"]["#" + attribute] = attribute;
            prefix = ", ";
        }
    }
    console.log('params: ', params);
    try {
        await docClient.update(params).promise();
        return note;
    }
    catch (err) {
        console.log('DynamoDB error: ', err);
        return null;
    }
}



exports.handler = async (event) => {
    console.log(JSON.stringify(event))
    switch (event.info.fieldName) {
        case "getNoteById":
            return await getNoteById(event.arguments.noteId);
        case "createNote":
            return await createNote(event.arguments.note);
        case "listNotes":
            return await listNotes();
        case "deleteNote":
            return await deleteNote(event.arguments.noteId);
        case "updateNote":
            return await updateNote(event.arguments.note);
        case "getNotebyTransactionId":
            return await getNotebyTransactionId(event.arguments.transactionId)
        default:
            return null;
    }
};

