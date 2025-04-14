const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Get the raw MongoDB URI
    const mongoUri = process.env.MONGO_URI;
    
    console.log('Attempting MongoDB connection...');
    
    // Parse the URI to check if it has a database specified
    let uri = mongoUri;
    
    // Make sure we always connect to the 'vortexly' database
    if (!uri.includes('/vortexly?')) {
      // The URI doesn't specify the database, so add it
      if (uri.includes('/?')) {
        // If there are query parameters but no database
        uri = uri.replace('/?', '/vortexly?');
      } else if (uri.includes('?')) {
        // If there are query parameters at the end with no /
        uri = uri.replace('?', '/vortexly?');
      } else {
        // If there are no query parameters
        uri = `${uri}/vortexly`;
      }
    }
    
    console.log(`Connecting to MongoDB: ${uri.replace(/mongodb\+srv:\/\/([^:]+):[^@]+@/, 'mongodb+srv://$1:****@')}`);
    
    // Connect to the database
    await mongoose.connect(uri);
    
    // Print the actual database we connected to
    console.log(`MongoDB connected successfully to database: ${mongoose.connection.db.databaseName}`);
    
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    console.error("Connection failed. Please check your MongoDB URI format and credentials.");
    process.exit(1);
  }
};

module.exports = connectDB;
