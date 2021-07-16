
export const fetchNotes = `
  query listNotes {
    listNotes {
      id
      lastName
      firstName
      phoneNumber
      status
      message      
    }
  }
`;

export const loadRequest = `
  query getNoteById($noteId: ID!) {
    getNoteById (noteId: $noteId) {
      id
      lastName
      firstName
      phoneNumber
      status
      message      
    }
  }
`;
