import React, { Component } from 'react';
import { fetchNotes as FetchNotes } from './GraphQL/queries'
import { onCreateNote, onUpdateNote } from './GraphQL/subscriptions'
import { createNote } from './GraphQL/mutations'
import { API, graphqlOperation } from 'aws-amplify'
import './App.css'
import CSVReader from 'react-csv-reader'
import axios from 'axios'
import cdkExports from './cdk-outputs.json'
import { v4 as uuidv4 } from 'uuid';
const outboundCallAPI = cdkExports.SMANotification.outboundCallAPI


class App extends Component {
    state = { notes: [] };

    componentDidMount = async () => {
      this.getRequests()

      this.createNoteListener = API.graphql(graphqlOperation(onCreateNote))
      .subscribe({
          next: noteData => {
            const newRequest = noteData.value.data.onCreateNote
            const prevRequests = this.state.notes.filter( notes => notes.id !== newRequest.id)
            const updatedRequests = [newRequest, ...prevRequests]
            this.setState({notes: updatedRequests})
          }
      })

      this.updatePostListener = API.graphql(graphqlOperation(onUpdateNote))
      .subscribe({
          next: noteData => {
                const { notes } = this.state
                const updateNote = noteData.value.data.onUpdateNote
                const index = notes.findIndex(notes => notes.id === updateNote.id)
                const updateNotes = [
                    ...notes.slice(0, index),
                  updateNote,
                  ...notes.slice(index + 1)
                  ]
                
                this.setState({ notes: updateNotes})
          }
      })
  }

  componentWillUnmount() {
    this.createNoteListener.unsubscribe()
  }

  getRequests = async () => {
      const notesData = await API.graphql(graphqlOperation(FetchNotes))
      this.setState({ notes: notesData.data.listNotes  })
  }

  sendCalls = async (event) => {
    event.preventDefault()
    const { notes } = this.state

    var toCall = []
    for await (const note of notes) {
      if (note.status === "Not Called") {
        toCall.push(note.id)
      }
    }

  await axios({
      method: 'post',
      url: outboundCallAPI + 'outboundCall',
      data: {
        id: toCall
      }
    });
  }

  processCSV = async (data, fileInfo) => {
    for (const datum of data) {
      const note = {
        id: uuidv4(),
        firstName: datum.firstName,
        lastName: datum.lastName,
        status: "Not Called",
        phoneNumber: datum.phoneNumber,
        message: datum.message
      }
      await API.graphql(graphqlOperation(createNote, { note }))
    }
  }

  csvParser = {
    header: true,    
    dynamicTyping: true,
    skipEmptyLines: true,
    transformHeader: header =>
    header
      .replace(/\W/g, '')      
  }

  render() {
    const { notes } = this.state
    return(
      <>
        <div className="table">
          <div className="table-row">
            <div className="table-head">Phone Number</div>
            <div className="table-head">First Name</div>
            <div className="table-head">Last Name</div>
            <div className="table-head">Message</div>
            <div className="table-head">Status</div>
          </div>
        {notes.filter(notes => notes.status === "Not Called").map((notes, index) => (
              <div key={index} className="table-row">
                  <div className="table-notCalled">{notes.phoneNumber}</div>
                  <div className="table-notCalled">{notes.firstName}</div>
                  <div className="table-notCalled">{notes.lastName}</div>
                  <div className="table-notCalled">{notes.message}</div>
                  <div className="table-notCalled">{notes.status}</div>
              </div>
        ))}
        {notes.filter(notes => notes.status === "Calling User" || notes.status === "Ringing").map((notes, index) => (
              <div key={index} className="table-row">
                  <div className="table-calling">{notes.phoneNumber}</div>
                  <div className="table-calling">{notes.firstName}</div>
                  <div className="table-calling">{notes.lastName}</div>
                  <div className="table-calling">{notes.message}</div>
                  <div className="table-calling">{notes.status}</div>
              </div>
        ))}
        {notes.filter(notes => notes.status === "Call Answered").map((notes, index) => (
              <div key={index} className="table-row">
                  <div className="table-calling">{notes.phoneNumber}</div>
                  <div className="table-calling">{notes.firstName}</div>
                  <div className="table-calling">{notes.lastName}</div>
                  <div className="table-calling">{notes.message}</div>
                  <div className="table-calling">{notes.status}</div>
              </div>
        ))}
        {notes.filter(notes => notes.status === "Appointment Confirmed").map((notes, index) => (
              <div key={index} className="table-row">
                  <div className="table-confirmed">{notes.phoneNumber}</div>
                  <div className="table-confirmed">{notes.firstName}</div>
                  <div className="table-confirmed">{notes.lastName}</div>
                  <div className="table-confirmed">{notes.message}</div>
                  <div className="table-confirmed">{notes.status}</div>
              </div>
        ))}
        {notes.filter(notes => notes.status === "Appointment Rejected").map((notes, index) => (
              <div key={index} className="table-row">
                  <div className="table-rejected">{notes.phoneNumber}</div>
                  <div className="table-rejected">{notes.firstName}</div>
                  <div className="table-rejected">{notes.lastName}</div>
                  <div className="table-rejected">{notes.message}</div>
                  <div className="table-rejected">{notes.status}</div>
              </div>
        ))}

        {notes.filter(notes => notes.status === "No Response").map((notes, index) => (
              <div key={index} className="table-row">
                  <div className="table-noAnswer">{notes.phoneNumber}</div>
                  <div className="table-noAnswer">{notes.firstName}</div>
                  <div className="table-noAnswer">{notes.lastName}</div>
                  <div className="table-noAnswer">{notes.message}</div>
                  <div className="table-noAnswer">{notes.status}</div>
              </div>
        ))}

        </div>
        <p></p>
        <button onClick={this.sendCalls}>Send Calls</button>
        <CSVReader
        label='Upload CSV: '
        onFileLoaded={this.processCSV}
        parserOptions={this.csvParser}
        />
      </>
    )
  }
}

export default App

