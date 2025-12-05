import React from 'react';
import Login from '../components/Login';
import Home from '../components/LoggedInHomePage';
import Navbar from '../components/Navbar';

function HomePage() {
  return (
    <>
     
      <main>
        <Navbar />
        <Home />
      </main>

    </>
  );
}

export default HomePage;
