import React from 'react';
import Navbar from '../components/Navbar';
import DetailedPlayerProfile from '../components/DetailedPlayerProfile';

function DetailedPlayerProfilePage() {
  return (
    <>
      <Navbar />
      <main>
        <DetailedPlayerProfile />
      </main>
    </>
  );
}

export default DetailedPlayerProfilePage;