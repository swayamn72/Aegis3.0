import mongoose from 'mongoose';
mongoose.connect('mongodb+srv://aegis-admin-1:swayamn75@cluster0.mxdgc7b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(async () => {
  const team = await mongoose.connection.db.collection('teams').findOne({_id: new mongoose.Types.ObjectId('699b4b11d859d3a229ee3d19')});
  console.log('STATISTICS:', JSON.stringify(team.statistics, null, 2));
  console.log('tournamentsWon (if any):', team.tournamentsWon || (team.statistics && team.statistics.tournamentsWon));
  mongoose.disconnect();
}).catch(e => console.error(e));
