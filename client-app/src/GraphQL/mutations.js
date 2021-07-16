
export const updateNote = `
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

export const createNote = `
    mutation CreateNote($note: NoteInput!) {
        createNote(note: $note) {
            id
            lastName
            firstName
            phoneNumber
            status
            message
        }
    }`