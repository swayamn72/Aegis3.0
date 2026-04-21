import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';

const ChildSafetyPolicyPage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans">
            <Navbar />
            <div className="container mx-auto px-6 py-24 max-w-4xl">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 md:p-12 shadow-xl">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-amber-500 text-transparent bg-clip-text mb-6">
                        Child Safety Policy
                    </h1>
                    <p className="text-zinc-400 mb-8 border-b border-zinc-800 pb-6">Last Updated: April 2026</p>

                    <div className="prose prose-invert prose-orange max-w-none space-y-6 text-zinc-300">
                        <p>
                            Aegis is deeply committed to the safety and well-being of all our users, particularly minors. We enforce a strictly zero-tolerance policy against any form of child exploitation, abuse, or grooming. This Child Safety Policy outlines our approach to keeping our community safe.
                        </p>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Zero Tolerance for CSAM</h2>
                        <p>
                            We have a zero-tolerance policy for Child Sexual Abuse Material (CSAM). Any user found sharing, requesting, producing, promoting, or distributing CSAM will face immediate and permanent bans without warning.
                        </p>
                        <p>
                            In addition to permanently banning accounts, we will proactively report the associated individuals and evidence to the appropriate law enforcement authorities, as well as relevant organizations such as the National Center for Missing and Exploited Children (NCMEC).
                        </p>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Prohibition of Grooming and Predatory Behavior</h2>
                        <p>
                            Aegis prohibits any behavior that attempts to groom, exploit, inappropriately interact with, or solicit sensitive materials from minors. This includes, but is not limited to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>Requesting sexually explicit images or content from minors.</li>
                            <li>Engaging in sexually explicit conversations with minors.</li>
                            <li>Attempting to manipulate, coerce, or isolate minors for predatory purposes.</li>
                            <li>Encouraging minors to engage in dangerous or illicit activities.</li>
                        </ul>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. Age Restriction</h2>
                        <p>
                            Aegis is not intended for children under the age of 13, and you must be at least 13 years old to create an account and use our services. If we determine that an account belongs to a user under the age of 13, the account will be immediately terminated and any associated data will be deleted as soon as reasonably possible.
                        </p>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Moderation & Reporting Mechanisms</h2>
                        <p>
                            We believe community safety is a shared responsibility, and we empower our users to take action:
                        </p>
                        <h3 className="text-xl font-medium text-orange-400 mt-6 mb-2">In-App Reporting</h3>
                        <p>
                            Users can easily report any inappropriate messages, profiles, or user-generated content directly within the Aegis application. Reports involving the safety of minors are immediately escalated to the highest priority for review.
                        </p>
                        <h3 className="text-xl font-medium text-orange-400 mt-6 mb-2">Direct Contact</h3>
                        <p>
                            If you witness or suspect any form of child exploitation, abuse, or grooming on Aegis, please report it immediately by emailing our safety team at <a href="mailto:swayamsn123@gmail.com" className="text-orange-400 hover:text-orange-300 transition-colors">swayamsn123@gmail.com</a>.
                        </p>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Enforcement</h2>
                        <p>
                            Violations of this Child Safety Policy are handled with the utmost severity. Enforcement actions may include, but are not limited to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>Immediate and permanent removal of the violating account from the Aegis platform.</li>
                            <li>Preservation of the violating account's data and activity logs for legal purposes.</li>
                            <li>Direct reporting of the user and their activities to law enforcement and child safety organizations.</li>
                        </ul>

                        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. Contact Us</h2>
                        <p>
                            For inquiries concerning our Child Safety Policy or to report an issue, please contact us at <a href="mailto:swayamsn123@gmail.com" className="text-orange-400 hover:text-orange-300 transition-colors">swayamsn123@gmail.com</a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChildSafetyPolicyPage;
