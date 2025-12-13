import React from 'react';
import Navbar from '../components/Navbar';
import DetailedTournamentInfo from '../components/DetailedTournamentInfo';

function DetailedTournamentInfoPage() {
  return (
    <>
      <Navbar />
      <main>
        <DetailedTournamentInfo />
      </main>
    </>
  );
}

export default DetailedTournamentInfoPage;
