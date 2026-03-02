import React from 'react';
import Navbar from '../components/Navbar';
import DetailedMatchInfo from '../components/DetailedMatchInfo';

function DetailedMatchInfoPage() {
    return (
        <>
            <Navbar />
            <main>
                <DetailedMatchInfo />
            </main>
        </>
    );
}

export default DetailedMatchInfoPage;
