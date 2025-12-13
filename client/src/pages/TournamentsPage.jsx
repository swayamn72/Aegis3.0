import React from 'react';
import Navbar from '../components/Navbar';
import Tournaments from '../components/Tournaments'; 

function TournamentsPage() {
  return (
    <>
      <Navbar />
      <main>
        <Tournaments />
      </main>
    </>
  );
}

export default TournamentsPage;
