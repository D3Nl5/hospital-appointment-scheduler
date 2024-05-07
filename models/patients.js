const mongoose = require('mongoose');

// Define the patient schema
const patientSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    password: String,
    dob: Date,
    weight: Number,
    height: Number,
    bmi: Number, // BMI calculated based on weight and height
    registrationTime: Date , // Add the registrationTime field
    role: String
});

// Create and export the Patient model
module.exports = mongoose.model('Patient', patientSchema);
