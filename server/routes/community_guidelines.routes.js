import express from 'express';

const router = express.Router();

// ============================================================================
// GET /api/community-guidelines — Returns the community guidelines text
// No auth required. Designed for the Flutter in-app policy viewer.
// ============================================================================
router.get('/', (req, res) => {
  res.status(200).json({
    title: 'Aegis Community Guidelines',
    lastUpdated: '2026-04-21',
    sections: [
      {
        heading: 'Welcome to Aegis Esports',
        body: 'By using Aegis Esports, you agree to follow these Community Guidelines. These rules exist to keep our platform safe, competitive, and respectful for everyone. Violation of these guidelines may result in warnings, content removal, temporary restrictions, or permanent account termination.',
      },
      {
        heading: '1. Respectful Conduct',
        body: 'Treat all players, teams, and organizers with respect. Harassment, bullying, threats, intimidation, or targeted abuse of any kind is strictly prohibited. This includes in-game names, profile content, team names, bios, chat messages, and any other user-generated content.',
      },
      {
        heading: '2. No Hate Speech or Discrimination',
        body: 'Content that promotes hatred, violence, or discrimination based on race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, disability, or age is not allowed. This applies to usernames, profile pictures, team logos, bios, and all forms of communication on the platform.',
      },
      {
        heading: '3. No Nudity or Sexual Content',
        body: 'Sexually explicit or suggestive content is strictly prohibited. This includes profile pictures, team logos, chat messages, and any other uploads. Keep all content appropriate for a general audience.',
      },
      {
        heading: '4. No Cheating or Match Manipulation',
        body: 'Fair play is the foundation of competitive esports. Using cheats, exploits, hacks, or any unauthorized third-party software is prohibited. Match-fixing, result manipulation, and colluding with opponents to affect tournament outcomes will result in immediate disqualification and potential permanent bans.',
      },
      {
        heading: '5. No Spam or Misleading Content',
        body: 'Do not spam chats, recruitment posts, or any other part of the platform. Misleading information, impersonation of other users, teams, or organizations, and deceptive practices are not allowed.',
      },
      {
        heading: '6. Privacy and Personal Information',
        body: 'Do not share personal information of others without their consent. This includes real names, addresses, phone numbers, or any other identifying information (doxxing). Protect your own personal information and be cautious when sharing details.',
      },
      {
        heading: '7. Appropriate Usernames and Content',
        body: 'All usernames, team names, team tags, bios, and profile content must be appropriate. Names that are offensive, vulgar, or designed to impersonate others are not allowed and will be changed or removed.',
      },
      {
        heading: '8. Report Violations',
        body: 'If you encounter content or behavior that violates these guidelines, please use the in-app report feature. We review all reports and take appropriate action. False or malicious reporting is also a violation of these guidelines.',
      },
      {
        heading: '9. Account Responsibility',
        body: 'You are responsible for all activity on your account. Do not share your login credentials. If you believe your account has been compromised, change your password immediately and contact support.',
      },
      {
        heading: '10. Enforcement',
        body: 'Aegis Esports reserves the right to enforce these guidelines at its discretion. Penalties may include content removal, temporary suspension, or permanent account termination depending on the severity and frequency of violations. All enforcement decisions are final.',
      },
      {
        heading: 'Contact',
        body: 'If you have questions about these guidelines, contact us at swayamsn123@gmail.com. For more information, review our Privacy Policy at https://aegis3-0.vercel.app/privacy-policy.',
      },
    ],
  });
});

export default router;
