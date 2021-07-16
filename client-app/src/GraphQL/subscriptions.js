export const onCreateNote = `subscription OnCreateNote {
    onCreateNote {
      id
      lastName
      firstName
      phoneNumber
      status
      message      
    }
  }
  `;

  export const onUpdateNote = `subscription onUpdateNote {
    onUpdateNote {
      id
      lastName
      firstName
      phoneNumber
      status
      message      
    }
  }
  `;