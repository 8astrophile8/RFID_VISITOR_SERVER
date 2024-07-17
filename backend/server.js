const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 5002;

app.use(cors());
app.use(bodyParser.json());

const mongoURI = 'mongodb+srv://root:1234@cluster01.okevryi.mongodb.net/test?retryWrites=true&w=majority';

mongoose.connect(mongoURI, {
  dbName: 'test' // Specify your database name here
})
.then(() => {
  console.log('MongoDB connected...');
  // Start the server only after the database connection is successful
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);

  });
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
});

const visitorSchema = new mongoose.Schema({
  name: String,
  aadhar: String,
  visiting: String,
  rfidTag: String // If storing RFID tag in visitor document
});

const Visitor = mongoose.model('Visitor', visitorSchema, 'visitor');

const rfidHistorySchema = new mongoose.Schema({
  rfidTag: String,
  user: String,
  entryTime: { type: Date, default: Date.now },
  exitTime: { type: Date }
});

const RFIDHistory = mongoose.model('RFIDHistory', rfidHistorySchema);

// Sample data
const visitorsData = [
  { name: 'John Doe', aadhar: '123456789012', visiting: 'Alice' },
  { name: 'Jane Smith', aadhar: '987654321098', visiting: 'Bob' },
  // Add more sample visitors as needed
];

const rfidHistoryData = [
  { rfidTag: 'RFID001', user: 'John Doe', entryTime: new Date() },
  { rfidTag: 'RFID002', user: 'Jane Smith', entryTime: new Date() }
  // Add more sample RFID history entries as needed
];

// Insert sample data only if needed


app.get('/api/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find(); // Correctly define 'visitors' here
    res.status(200).json(visitors);
  } catch (error) {
    console.error('Error fetching visitors:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.put('/api/visitors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rfidTag } = req.body;
    
    const visitor = await Visitor.findById(id);
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    // Log the current RFID tag value with exitTime before updating it
    if (visitor.rfidTag) {
      await RFIDHistory.findOneAndUpdate(
        { rfidTag: visitor.rfidTag, user: visitor.name, exitTime: { $exists: false } },
        { exitTime: new Date() }
      );
    }

    // Update the visitor's RFID tag
    visitor.rfidTag = rfidTag;
    const updatedVisitor = await visitor.save();

    // Log the new RFID tag value with entryTime
    await RFIDHistory.create({ rfidTag, user: visitor.name });

    res.status(200).json(updatedVisitor);
  } catch (error) {
    console.error('Error updating RFID tag:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.delete('/api/visitors/:id/rfidTag', async (req, res) => {
  try {
    const { id } = req.params;

    const visitor = await Visitor.findById(id);
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    if (!visitor.rfidTag) {
      return res.status(400).json({ error: 'Visitor does not have an RFID tag assigned' });
    }

    // Log the current RFID tag value with exitTime before unlinking it
    await RFIDHistory.findOneAndUpdate(
      { rfidTag: visitor.rfidTag, user: visitor.name, exitTime: { $exists: false } },
      { exitTime: new Date() }
    );

    // Remove the RFID tag assignment from the visitor document
    visitor.rfidTag = null;
    await visitor.save();

    res.status(200).json({ message: 'RFID tag unlinked successfully' });
  } catch (error) {
    console.error('Error unlinking RFID tag:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/visitors', async (req, res) => {
  const { name, aadhar, visiting, rfidTag } = req.body;
  try {
    const newVisitor = new Visitor({ name, aadhar, visiting, rfidTag });
    await newVisitor.save();
    res.status(201).json(newVisitor);
  } catch (error) {
    console.error('Error adding visitor:', error);
    res.status(500).json({ error: 'Failed to add visitor', details: error.message });
  }
});

app.post('/api/check_tag', async (req, res) => {
  const { tagID } = req.body;
  
  try {
    const visitor = await Visitor.findOne({ rfidTag: tagID });
    if (!visitor) {
      return res.status(404).json({ status: 'error', message: 'Visitor not found' });
    }
    
    // If visitor found, return visitor details
    res.status(200).json({
      status: 'success',
      visitorName: visitor.name,
      personToVisit: visitor.visiting
    });
  } catch (error) {
    console.error('Error checking RFID tag:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error', details: error.message });
  }
});