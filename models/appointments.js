const mongoose = require('mongoose');

// Define the appointment schema
const appointmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient', // Reference to the Patient model
        required: true
    },
    dateTime: {
        type: Date,
        required: true
    },
    dateReservation: {
        type: Date,
        required: true
    },
    dateCanceled: {
        type: Date
    },
    dateCompleted: {
        type: Date
    },
    // doctorId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Doctor', // Reference to the Doctor model (or nurse)
    //     required: true
    // },
    status: {
        type: String,
        enum: ["scheduled", "completed", "canceled"],
        required: true
    },
    dose: {
        type: Number, // Assuming dose is a numeric value
        required: true
    }
});

// Create and export the Appointment model
module.exports = mongoose.model('Appointment', appointmentSchema);
