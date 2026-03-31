import mongoose from 'mongoose';
mongoose.connect('mongodb+srv://aegis-admin-1:swayamn75@cluster0.mxdgc7b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(async () => {
  const matches = await mongoose.connection.db.collection('matches')
    .find({'results.team': new mongoose.Types.ObjectId('699b4b11d859d3a229ee3d19')})
    .toArray();
    
  console.log('Matches:', matches.map(m => ({
    map: m.map, 
    actualEndTime: m.actualEndTime, 
    tournamentPhase: m.tournamentPhase,
    status: m.status
  })));
  
  mongoose.disconnect();
}).catch(e => console.error(e));
