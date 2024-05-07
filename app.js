const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser'); // Add body-parser middleware
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();

// MongoDB Connection
mongoose.connect('mongodb://localhost/hospital_appointment_scheduler', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

// Serve static files (HTML, CSS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing JSON requests
app.use(bodyParser.json());
app.use(cookieParser()); // Use cookie-parser middleware

// Include the patient model
const Patient = require('./models/patients');
// Include the appointment model
const Appointment = require('./models/appointments.js');

// Secret key for JWT (keep this secret)
const secretKey = 'yourSecretKey'; // Replace with a strong, secret key

const nodemailer = require('nodemailer');

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'Gmail', // e.g., 'Gmail', 'Outlook', 'SendGrid', etc.
  auth: {
      user: 't08468642@gmail.com',
      pass: 'bcrcudxgpzhcqvkd'//test1234!@#$  -> actuall pass //bcrcudxgpzhcqvkd
  }
});

// Routes
app.get('/available-appointments', (req, res) => {
    // Render the 'available-appointments.html' page
    res.sendFile(path.join(__dirname, 'public', 'available-appointments.html'));
});

// Route to fetch available days
app.get('/available-days', async (req, res) => {
    try {
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'userId not found in token' });
        }

        const userId = decoded.userId;

        const patient = await Patient.findById(userId);

        const bmi = parseFloat(patient.bmi);
        const dose = 0.0091 * Math.pow(bmi, 3) - 0.7925 * Math.pow(bmi, 2) + 25.89 * bmi - 79.442;

        console.log('Patient dose: '+dose)
        // console.log('userId: '+userId)
        // Get tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Calculate the date one month from tomorrow
        const oneMonthFromTomorrow = new Date(tomorrow);
        oneMonthFromTomorrow.setMonth(oneMonthFromTomorrow.getMonth() + 1);

        // Fetch all appointments within the date range (from tomorrow to one month from tomorrow)
        const appointments = await Appointment.find({
            dateTime: {
                $gte: tomorrow,
                $lt: oneMonthFromTomorrow,
            },
            status: 'scheduled' // Adding the status check
        });

        // Create an object to store the counts of appointments and doses for each date
        const appointmentData = {};

        // Count appointments and calculate cumulative dose for each date
        appointments.forEach((appointment) => {
            const date = new Date(appointment.dateTime);
            const dateString = date.toISOString().split('T')[0]; // Get the date-only string
            const dose = appointment.dose || 0;

            if (!appointmentData[dateString]) {
                appointmentData[dateString] = {
                    appointmentCount: 1,
                    cumulativeDose: dose,
                };
            } else {
                appointmentData[dateString].appointmentCount++;
                appointmentData[dateString].cumulativeDose += dose;
            }
        });

        // Generate an array of available dates in the date range, excluding Saturdays and Sundays
        const availableDates = [];
        for (let date = new Date(tomorrow); date < oneMonthFromTomorrow; date.setDate(date.getDate() + 1)) {
            // Check if the date is not a Saturday (day 6) or Sunday (day 0)
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
            const dateString = `${dayOfWeek}, ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
            
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                const dataForDate = appointmentData[date.toISOString().split('T')[0]] || { appointmentCount: 0, cumulativeDose: 0 };
                let color; 

                // Set color based on the number of appointments and cumulative dose
                if (dataForDate.appointmentCount >= 8 || (dose + dataForDate.cumulativeDose) > 2400) {
                    color = 'red'; // 8 or more appointments or cumulative dose over 2400 - red
                } else if (dataForDate.appointmentCount >= 4 && dataForDate.appointmentCount <= 7) {
                    color = 'orange'; // 4-7 appointments - orange
                } else {
                    color = 'green'; // Default color is green
                }

                availableDates.push({
                    date: dateString,
                    color: color, // Add color property
                    cumulativeDose: dataForDate.cumulativeDose,
                });
            }
        }

        // Respond with the available dates as JSON
        res.json({ availableDates });
    } catch (error) {
        // Handle errors
        console.error("Error fetching available days:", error);
        res.status(500).send({ error: "Failed to fetch available days." });
    }
});

// Route to fetch available hours for a specific date
app.get('/available-hours', async (req, res) => {
    try {
        const selectedDateText = req.query.date; // Retrieve the selected date from the request query

        // Parse the date string to a JavaScript Date object
        const dateParts = selectedDateText.split(", ")[1].split("/");
        const year = parseInt(dateParts[2]);
        const month = parseInt(dateParts[1]) - 1; // Months are zero-based in JavaScript
        const day = parseInt(dateParts[0]);
        const selectedDate = new Date(year, month, day);

        console.log(selectedDate);

        // Fetch appointments for the selected date
        const appointments = await Appointment.find({ dateTime: { $gte: selectedDate, $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000) }, status: 'scheduled'  });

        console.log(appointments);

        // Extract hours from appointments
        const reservedHours = appointments.map(appointment => {
            const appointmentDate = appointment.dateTime;
            return appointmentDate.getHours() + ':' + (appointmentDate.getMinutes() < 10 ? '0' : '') + appointmentDate.getMinutes();
        });

        console.log(reservedHours);

        // Define all available hours
        const allHours = [
            "8:00", "9:00", "10:00", "11:00",
            "12:00", "13:00", "14:00", "15:00"
        ];

        // Filter out the reserved hours to get the available hours
        const availableHours = allHours.filter(hour => !reservedHours.includes(hour));

        // Send the available hours as a response
        res.status(200).json({ availableHours, allHours });
    } catch (error) {
        console.error("Error fetching available hours:", error);
        res.status(500).json({ error: "Failed to fetch available hours." });
    }
});

// Route to render the profile form with current patient information
app.get('/profile', async (req, res) => {
    try {

        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'First name not found in token' });
        }

        const patientId = decoded.userId;
    
        // Fetch the patient data from the database
        const patient = await Patient.findById(patientId);

        if (!patient) {
            return res.status(404).send({ error: 'Patient not found.' });
        }


        // Reformat the date to match the required format "yyyy-MM-dd"
        const formattedPatient = {
            ...patient._doc,
            dob: new Date(patient.dob).toISOString().split('T')[0]
        };

        console.log(formattedPatient);
        // Now 'formattedPatient' contains the date in the required format "yyyy-MM-dd"
        res.json({ patient: formattedPatient });
    } catch (error) {
        // Handle errors
        console.error('Error fetching patient information:', error);
        res.status(500).send({ error: 'Failed to fetch patient information.' });
    }
});

// Define the route for fetching all users
app.get('/admin-users', async (req, res) => {
    try {
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Only admins can access this route.' });
        }

        // Fetch all users
        const users = await Patient.find();

        // Send the users as a response
        res.status(200).json({ users });
    } catch (error) {
        // Handle errors
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users." });
    }
});

// Route to fetch appointment history for a user
app.get('/appointment-history', async (req, res) => {
    try {
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'userId not found in token' });
        }

        const userId = decoded.userId;

        // Fetch all appointments for the user
        const appointments = await Appointment.find({ patient: userId });

        // Send the appointment history as a response
        res.status(200).json({ appointments });
    } catch (error) {
        // Handle errors
        console.error("Error fetching appointment history:", error);
        res.status(500).json({ error: "Failed to fetch appointment history." });
    }
});

app.get('/admin-appointment-history', async (req, res) => {
    try {
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'userId not found in token' });
        }

        const userId = decoded.userId;

        // Check if the user has admin privileges
        const user = await Patient.findById(userId);
        if (!user || (user.role !== 'admin' && user.role !== 'nurse')) {
            return res.status(403).json({ error: 'Access forbidden' });
        }

        // Fetch all appointments with the required additional information
        const appointments = await Appointment.find().populate('patient', 'firstName lastName');

        // Send the appointment history as a response
        res.status(200).json({ appointments });
    } catch (error) {
        // Handle errors
        console.error("Error fetching appointment history:", error);
        res.status(500).json({ error: "Failed to fetch appointment history." });
    }
});

// Route to add a new patient
app.post('/addPatient', async (req, res) => {
    try {
        // Check if all required fields exist and are not null
        const requiredFields = ['firstName', 'lastName', 'email', 'password', 'dob', 'weight', 'height'];
        
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).send({ error: `${field} is required.` });
            }
        }

        const { email, password } = req.body;

        // Check if a patient with the same email already exists
        const existingPatient = await Patient.findOne({ email });

        if (existingPatient) {
            return res.status(400).send({ error: "A patient with this email already exists." });
        }

        // Password validation regex: at least 8 characters, one capital letter, one number, one special character
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!password.match(passwordRegex)) {
            return res.status(400).send({ error: "Password must be at least 8 characters, contain one capital letter, one number, and one special character." });
        }

        // Create a new patient document using the request body data
        const newPatient = new Patient(req.body);

        // Calculate BMI based on weight and height
        newPatient.bmi = calculateBMI(newPatient.weight, newPatient.height);
        newPatient.registrationTime = new Date();
        newPatient.role = 'patient';

        // Save the new patient document to the MongoDB collection
        await newPatient.save();

        // Respond with a success message
        res.status(201).send({ message: "Patient added successfully." });
    } catch (error) {
        // Handle errors
        console.error("Error adding patient:", error);
        res.status(500).send({ error: "Failed to add patient." });
    }
});

// Route for patient login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if a patient with the given email exists
        const patient = await Patient.findOne({ email });

        if (!patient) {
            return res.status(401).send({ error: "Invalid email or password." });
        }

        // Check if the provided password matches the stored password
        if (patient.password !== password) {
            return res.status(401).send({ error: "Invalid email or password." });
        }

        // If email and password are valid, generate a JWT token

        const token = jwt.sign(
            {
                userId: patient._id,
                firstName: patient.firstName, // Include the firstName property
                role: patient.role
            },
            secretKey,
            { expiresIn: '1h' } 
        );

        // Respond with a success message, the patient data, and the token
        res.status(200).send({ message: "Login successful.", patient: patient, token: token });
    } catch (error) {
        // Handle errors
        console.error("Error during login:", error);
        res.status(500).send({ error: "Login failed." });
    }
});

// Route to get the user's first name from the token
app.get('/getFirstName', (req, res) => {
    const token = req.cookies.token; // Retrieve the token from the "token" cookie
    console.log("Token received:", token);

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Verify and decode the token
        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.firstName) {
            return res.status(400).json({ error: 'First name not found in token' });
        }

        const firstName = decoded.firstName;
        const role = decoded.role;
        

        res.status(200).json({ firstName, role });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired' });
        }

        console.error('Error while decoding token:', error);
        res.status(500).json({ error: 'Failed to decode token' });
    }
});

// Route to update a patient's profile
app.post('/updateProfile', async (req, res) => {
    try {
        // Check if all required fields exist and are not null
        const requiredFields = ['firstName', 'lastName', 'email', 'password', 'dob', 'weight', 'height'];

        for (const field of requiredFields) {
            if (!req.body[field]) {
                console.log(`${field} is required.`);
                return res.status(400).send({ error: `${field} is required.` });
            }
        }

        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'First name not found in token' });
        }

        const userId = decoded.userId;

        const { email } = req.body;
        console.log("Provided email:", email);
        console.log("User ID:", userId);

        // Check if the provided email is already used by another patient
        const existingPatient = await Patient.findOne({ email });

        if (existingPatient && existingPatient._id.toString() !== userId) {
            console.log("A patient with this email already exists.");
            return res.status(400).send({ error: "A patient with this email already exists." });
        }

        // Retrieve the existing patient using the userId from the token
        const patient = await Patient.findById(userId);
        console.log("Existing patient:", patient);

        if (!patient) {
            console.log("Patient not found.");
            return res.status(404).send({ error: 'Patient not found.' });
        }

        // Update the patient document with the new data
        for (const field of requiredFields) {
            patient[field] = req.body[field];
        }

        // Calculate BMI based on updated weight and height
        patient.bmi = calculateBMI(patient.weight, patient.height);
        console.log("Updated patient:", patient);

        // Save the updated patient document to the MongoDB collection
        await patient.save();

        // Respond with a success message
        console.log("Profile updated successfully.");
        res.status(200).send({ message: "Profile updated successfully." });
    } catch (error) {
        // Handle errors
        console.error("Error updating patient profile:", error);
        res.status(500).send({ error: "Failed to update patient profile." });
    }
});

app.post('/update-user', async (req, res) => {
    try {
        // Check if all required fields exist and are not null
        const requiredFields = ['firstName', 'lastName', 'email', 'password', 'dob', 'weight', 'height','role'];

        for (const field of requiredFields) {
            if (!req.body[field]) {
                console.log(`${field} is required.`);
                return res.status(400).send({ error: `${field} is required.` });
            }
        }
        
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'userId not found in token' });
        }

        const loggedUserId = decoded.userId;

        // Check if the user has admin privileges
        const user = await Patient.findById(loggedUserId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Access forbidden' });
        }

        const { userId, firstName, lastName, email, password, dob, weight, height, role } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required.' });
        }

       // Check if the provided email is already used by another patient
       const existingUser = await Patient.findOne({ email });

       if (existingUser && existingUser._id.toString() !== userId) {
           console.log("A patient with this email already exists.");
           return res.status(400).send({ error: "A patient with this email already exists." });
       }

       // Retrieve the existing patient using the userId from the token
       const newUser = await Patient.findById(userId);
       console.log("Existing patient:", newUser);

       if (!newUser) {
           console.log("Patient not found.");
           return res.status(404).send({ error: 'Patient not found.' });
       }

        // Update the user document with the new data
        newUser.firstName = firstName;
        newUser.lastName = lastName;
        newUser.email = email;
        newUser.password = password;
        newUser.dob = dob;
        newUser.weight = weight;
        newUser.height = height;
        // Calculate BMI based on updated weight and height
        newUser.bmi = calculateBMI(newUser.weight, newUser.height);
        newUser.role = role;

        // Save the updated user document to the MongoDB collection
        await newUser.save();

        // Respond with a success message
        console.log("User updated successfully.");
        res.status(200).send({ message: "User updated successfully." });
    } catch (error) {
        // Handle errors
        console.error("Error updating user:", error);
        res.status(500).send({ error: "Failed to update user." });
    }
});

// Route to add a new appointment
app.post('/addAppointment', async (req, res) => {
    try {
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'userId not found in token' });
        }

        const userId = decoded.userId;

        // Create a new appointment document using the request body data
        const newAppointment = new Appointment();

        const dateObj = new Date(req.body.dateTime);
        const compareDate = new Date('2023-10-29');
        //Change time from UTC+3 to UTC+2
        if (dateObj > compareDate) {
            // If the date is greater than October 29, 2023
            dateObj.setHours(dateObj.getHours() - 2); // Adjust by -2 hours
        } else {
            // If the date is not greater than October 29, 2023
            dateObj.setHours(dateObj.getHours() - 3); // Adjust by -3 hours
        }  
        // console.log("dateObj : ", dateObj);
        newAppointment.dateTime = dateObj;

        // const formattedDate = dateObj.toISOString();
        // console.log("formattedDate : ", formattedDate);
        // newAppointment.dateTime = formattedDate;
        // console.log("newAppointment.dateTime : ", newAppointment.dateTime);


        // Calculate the dose based on BMI (assuming you have fetched the patient's BMI)
        const patient = await Patient.findById(userId);
        if (patient) {
            const bmi = parseFloat(patient.bmi);
            const dose = 0.0091 * Math.pow(bmi, 3) - 0.7925 * Math.pow(bmi, 2) + 25.89 * bmi - 79.442;
            
            newAppointment.patient = {
                _id: patient._id,
                firstName: patient.firstName,
                lastName: patient.lastName
            };
            newAppointment.status = "scheduled";
            // Set the dose field with only two decimal places
            newAppointment.dose = parseFloat(dose.toFixed(2));
            const currentUTC = new Date().toUTCString(); // Get the current UTC time
            newAppointment.dateReservation = currentUTC;
        } else {
            // Handle the case where the patient is not found
            res.status(404).send({ error: "Patient not found." });
            return;
        }

        // Save the new appointment document to the MongoDB collection
        await newAppointment.save();

        console.log("Appointment: "+ newAppointment)

        // Compose the email content
        const mailOptions = {
            from: 'info@appointmentplus.com',
            to: patient.email,
            subject: 'Appointment Confirmation',
            text: `
            Dear ${patient.lastName} ${patient.firstName},

            We are delighted to confirm your upcoming appointment on ${newAppointment.dateTime.toLocaleDateString()} at ${newAppointment.dateTime.toLocaleTimeString()}. Our team is eagerly anticipating your visit and is dedicated to ensuring a seamless and exceptional experience for you. Please feel free to reach out to us if you have any questions or need further assistance before your appointment.
            
            We look forward to welcoming you and providing you with our best service.
            
            Best regards,
            AppointmentPlus`
        };
    
        // Send the email
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.error('Error sending email:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });

        // Respond with a success message
        res.status(201).send({ message: "Appointment added successfully." });
    } catch (error) {
        // Handle errors
        console.error("Error adding appointment:", error);
        res.status(500).send({ error: "Failed to add appointment." });
    }
});

app.post('/cancel-appointment', async (req, res) => {
    try {
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'userId not found in token' });
        }
        
        const { appointmentId } = req.body;
        console.log(appointmentId);

        // Find the appointment by ID
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }

        if (appointment.status !== 'scheduled') {
            return res.status(400).json({ error: 'Appointment cannot be canceled as it is not in scheduled status.' });
        }

        // Update the status of the appointment to "cancelled"
        appointment.status = 'canceled';
        const currentUTC = new Date().toUTCString(); // Get the current UTC time
        appointment.dateCanceled = currentUTC;

        // Save the updated appointment
        await appointment.save();

        // Return a success message
        res.status(200).json({ message: 'Appointment canceled successfully.' });
    } catch (error) {
        // Handle errors
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ error: 'Failed to cancel appointment.' });
    }
});

app.post('/completed-appointment', async (req, res) => {
    try {
        const token = req.cookies.token; // Retrieve the token from the "token" cookie
        console.log("Token received:", token);

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
        console.log("Decoded token:", decoded);

        if (!decoded.userId) {
            return res.status(400).json({ error: 'userId not found in token' });
        }

        const userId = decoded.userId;

        // Check if the user has admin privileges
        const user = await Patient.findById(userId);
        if (!user || (user.role !== 'admin' && user.role !== 'nurse')) {
            return res.status(403).json({ error: 'Access forbidden' });
        }

        const { appointmentId } = req.body;
        console.log(appointmentId);

        // Find the appointment by ID
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found.' });
        }

        if (appointment.status !== 'scheduled') {
            return res.status(400).json({ error: 'Appointment cannot be canceled as it is not in scheduled status.' });
        }

        // Update the status of the appointment to "cancelled"
        appointment.status = 'completed';
        const currentUTC = new Date().toUTCString(); // Get the current UTC time
        appointment.dateCompleted = currentUTC;

        // Save the updated appointment
        await appointment.save();

        // Return a success message
        res.status(200).json({ message: 'Appointment completed successfully.' });
    } catch (error) {
        // Handle errors
        console.error('The operation cannot be completed:', error);
        res.status(500).json({ error: 'Failed to complete appointment.' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Function to calculate BMI
function calculateBMI(weight, height) {
    return (weight / ((height / 100) * (height / 100))).toFixed(2);
}


