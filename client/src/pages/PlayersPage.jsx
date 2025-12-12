import React from 'react';
import Navbar from '../components/Navbar';
import AegisPlayers from '../components/AegisPlayers';

function PlayersPage() {
  return (
    <>
      <Navbar />
      <main>
        <AegisPlayers />
      </main>
    </>
  );
}

export default PlayersPage;
