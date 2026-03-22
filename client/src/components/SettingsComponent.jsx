import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  User, Shield, HelpCircle,
  Bug, MessageSquare, Trash2, ExternalLink,
  Save, X, Check, AlertTriangle, Globe,
  Lock, Key, Upload, ChevronRight, Camera, Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/axiosConfig';



const SettingsComponent = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const [savedMessage, setSavedMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);



  // New state for support form
  const [supportSubject, setSupportSubject] = useState('');
  const [supportCategory, setSupportCategory] = useState('Account Issues');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  // New state for bug report form
  const [bugTitle, setBugTitle] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [bugPriority, setBugPriority] = useState('Low');
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  // Password update state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // FAQ state
  const [openFaq, setOpenFaq] = useState(null);

  const faqData = [
    {
      question: "How do I join a tournament?",
      answer: "To join a tournament, navigate to the 'Tournaments' page from the sidebar, select a tournament that is currently open for registration, and click the 'Join Tournament' button. Make sure your team meets the eligibility requirements."
    },
    {
      question: "How can I change my team?",
      answer: "You can manage your team by clicking on your profile and selecting 'My Team'. From there, you can view your current team, leave it, or join a new one if you're not already in one."
    },
    {
      question: "How do I report a bug or issue?",
      answer: "Use the 'Support & Help' section in Settings to send a direct message to our support team or submit a detailed bug report using the 'Report a Bug' form."
    }
  ];

  const { user } = useAuth(); // get user from AuthContext

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Optional: Update profileSettings.profilePicture with a preview URL or base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileSettings(prev => ({ ...prev, profilePicture: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Profile settings state
  const [profileSettings, setProfileSettings] = useState({
    // Personal Info
    realName: '',
    age: '',
    location: '',
    country: 'India',
    bio: '',
    languages: [],
    profilePicture: '',

    // Gaming Info
    primaryGame: 'BGMI',
    earnings: '',
    inGameRole: [],

    // Team & Goals
    teamStatus: '',
    availability: '',

    // Social & Contact
    discordTag: '',
    instagram: '',
    YouTube: '',
    profileVisibility: 'public',

    // Appearance
    cardTheme: 'orange'
  });





  const AegisMascot = () => (
    <div className="relative">
      <div className="w-12 h-14 bg-gradient-to-b from-orange-400 via-red-500 to-amber-600 rounded-t-full rounded-b-lg border border-orange-300 relative overflow-hidden shadow-lg shadow-orange-500/50">
        <div className="absolute inset-0">
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-yellow-300/30 rounded-full" />
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-orange-200/40 rounded-full" />
        </div>
        <div className="absolute top-4 left-2 w-1 h-1 bg-yellow-300 rounded-full animate-pulse" />
        <div className="absolute top-4 right-2 w-1 h-1 bg-yellow-300 rounded-full animate-pulse" />
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-2 h-0.5 bg-yellow-200/90 rounded-full" />
      </div>
    </div>
  );

  const showSaveMessage = (message) => {
    setSavedMessage(message);
    setTimeout(() => setSavedMessage(''), 3000);
  };

  // Fetch current user profile on mount (now from context)
  useEffect(() => {
    if (user) {
      setProfileSettings({
        realName: user.realName || '',
        age: user.age || '',
        location: user.location || '',
        country: 'India', // fixed
        bio: user.bio || '',
        languages: user.languages || [],
        profilePicture: user.profilePicture || '',
        primaryGame: user.primaryGame || 'BGMI',
        earnings: user.earnings || '',
        inGameRole: user.inGameRole || [],
        teamStatus: user.teamStatus || '',
        availability: user.availability || '',
        discordTag: user.discordTag || '',
        instagram: user.instagram || '',
        YouTube: user.YouTube || user.youtube || '', // fallback for both
        profileVisibility: user.profileVisibility || 'public',
        cardTheme: user.cardTheme || 'orange',
      });
    }
  }, [user]);

  // Submit updated profile to backend
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // If there's a selected file, upload it first
      if (selectedFile) {
        const formData = new FormData();
        formData.append('profilePicture', selectedFile);

        const uploadResponse = await axiosInstance.post('/api/players/upload-pfp', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Update profileSettings with the new profilePicture URL
        setProfileSettings(prev => ({ ...prev, profilePicture: uploadResponse.data.profilePicture }));
        setSelectedFile(null); // Clear selected file after upload
      }

      // Now update the profile with other settings
      const updateData = { ...profileSettings };

      // Clean up empty strings that might cause validation issues on the backend
      ['teamStatus', 'availability', 'age', 'location', 'realName'].forEach(field => {
        if (updateData[field] === '') {
          delete updateData[field];
        }
      });

      const response = await axiosInstance.put('/api/players/update-profile', updateData);
      showSaveMessage('Profile settings saved successfully!');
      toast.success('Your profile was updated successfully'); // <-- updated toast message
      setProfileSettings(prev => ({ ...prev, ...response.data.player }));
    } catch (error) {
      const errorMessage = error.message || error?.error || 'Failed to save profile';
      const validationErrors = error.errors ? Object.values(error.errors).map(e => e.message).join(', ') : '';
      showSaveMessage(`Error: ${errorMessage}${validationErrors ? ' - ' + validationErrors : ''}`);
      toast.error(`Error: ${errorMessage}${validationErrors ? ' - ' + validationErrors : ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const SettingsSection = ({ id, title, icon: Icon, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30'
        : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'
        }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{title}</span>
    </button>
  );

  const ToggleSwitch = ({ enabled, onChange, size = 'default' }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex items-center ${size === 'small' ? 'h-5 w-9' : 'h-6 w-11'
        } rounded-full transition-colors duration-200 ${enabled ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-zinc-600'
        }`}
    >
      <span
        className={`inline-block ${size === 'small' ? 'h-3 w-3' : 'h-4 w-4'
          } rounded-full bg-white transition-transform duration-200 ${enabled ? (size === 'small' ? 'translate-x-5' : 'translate-x-6') : 'translate-x-1'
          }`}
      />
    </button>
  );

  const handleUpdatePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const response = await axiosInstance.post('/api/players/change-password', {
        currentPassword,
        newPassword
      });

      toast.success(response.data.message || 'Password updated successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to update password';
      toast.error(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };




  // Check if profile is incomplete
  const isProfileIncomplete = !(
    profileSettings.realName &&
    profileSettings.age &&
    profileSettings.location &&
    profileSettings.country &&
    profileSettings.primaryGame &&
    profileSettings.teamStatus &&
    profileSettings.availability
  );

  return (
    <div className="bg-gradient-to-br from-zinc-950 via-stone-950 to-neutral-950 min-h-screen text-white font-sans pt-24">
      <div className="container mx-auto px-6 py-8">

        {/* Incomplete Profile Banner */}
        {isProfileIncomplete && (
          <div className="bg-gradient-to-r from-orange-500/20 via-red-500/20 to-amber-600/20 border-2 border-orange-500/50 rounded-2xl p-6 mb-8 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-20 bg-gradient-to-b from-orange-400 via-red-500 to-amber-600 rounded-t-full rounded-b-lg border-2 border-orange-300 relative overflow-hidden shadow-lg shadow-orange-500/50 animate-pulse">
                  <div className="absolute inset-0">
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-yellow-300/30 rounded-full" />
                  </div>
                  <div className="absolute top-6 left-3 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
                  <div className="absolute top-6 right-3 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
                  <div className="absolute top-9 left-1/2 transform -translate-x-1/2 w-3 h-1 bg-yellow-200/90 rounded-full" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <h3 className="text-xl font-bold text-orange-400">⚔️ Mission Incomplete! ⚔️</h3>
                </div>
                <p className="text-zinc-300 mb-3">
                  Your warrior profile needs attention! Complete your stats to unlock the full power of Aegis and join the battlefield.
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {!profileSettings.realName && <span className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300">Real Name</span>}
                  {!profileSettings.age && <span className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300">Age</span>}
                  {!profileSettings.location && <span className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300">Location</span>}
                  {!profileSettings.primaryGame && <span className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300">Primary Game</span>}
                  {!profileSettings.teamStatus && <span className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300">Team Status</span>}
                  {!profileSettings.availability && <span className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300">Availability</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <AegisMascot />
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-zinc-400">Manage your account preferences and privacy settings</p>
            </div>
          </div>

          {savedMessage && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-green-400 text-sm">{savedMessage}</span>
            </div>
          )}
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 sticky top-[calc(5rem+1rem)] z-20">
              <nav className="space-y-2">
                <SettingsSection
                  id="profile"
                  title="Edit Profile"
                  icon={User}
                  isActive={activeSection === 'profile'}
                  onClick={setActiveSection}
                />
                <SettingsSection
                  id="privacy"
                  title="Privacy & Security"
                  icon={Shield}
                  isActive={activeSection === 'privacy'}
                  onClick={setActiveSection}
                />
                <SettingsSection
                  id="support"
                  title="Support & Help"
                  icon={HelpCircle}
                  isActive={activeSection === 'support'}
                  onClick={setActiveSection}
                />
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">

            {/* Edit Profile Section */}
            {activeSection === 'profile' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <User className="w-6 h-6 text-orange-400" />
                  Edit Profile
                </h2>

                <div className="space-y-6">
                  {/* Personal Information Section */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white">Personal Information</h3>

                    {/* Username Display (Read-only) */}
                    <div>
                      <label className="block text-zinc-300 font-medium mb-2 flex items-center gap-2">
                        Username
                        <span className="text-xs text-zinc-500 font-normal">(Cannot be changed)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={user?.username || ''}
                          readOnly
                          disabled
                          className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-2 text-zinc-400 cursor-not-allowed opacity-75"
                        />
                        <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Real Name *</label>
                        <input
                          type="text"
                          value={profileSettings.realName}
                          onChange={(e) => setProfileSettings({ ...profileSettings, realName: e.target.value })}
                          placeholder="Enter your real name"
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Age *</label>
                        <input
                          type="number"
                          value={profileSettings.age}
                          onChange={(e) => setProfileSettings({ ...profileSettings, age: e.target.value })}
                          placeholder="Your age"
                          min="13"
                          max="99"
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">City/Location *</label>
                        <input
                          type="text"
                          value={profileSettings.location}
                          onChange={(e) => setProfileSettings({ ...profileSettings, location: e.target.value })}
                          placeholder="e.g., Mumbai, Maharashtra"
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Country</label>
                        <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-400 flex items-center gap-2 cursor-not-allowed select-none">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-white">India</span>
                          <span className="ml-auto text-xs text-zinc-500">Fixed</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-medium mb-2">Bio</label>
                      <textarea
                        value={profileSettings.bio}
                        onChange={(e) => setProfileSettings({ ...profileSettings, bio: e.target.value })}
                        placeholder="Tell us about yourself, your gaming journey, and what makes you unique..."
                        rows={4}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-medium mb-3">Languages Spoken</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Punjabi'].map(lang => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              const newLanguages = profileSettings.languages.includes(lang)
                                ? profileSettings.languages.filter(l => l !== lang)
                                : [...profileSettings.languages, lang];
                              setProfileSettings({ ...profileSettings, languages: newLanguages });
                            }}
                            className={`px-4 py-2 rounded-lg border transition-all ${profileSettings.languages.includes(lang)
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                              : 'bg-zinc-800/50 border-zinc-600 text-zinc-300 hover:border-zinc-500'
                              }`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Profile Picture Upload */}
                    <div>
                      <label className="block text-zinc-300 font-medium mb-2">Profile Picture</label>
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-orange-500 file:to-red-600 file:text-white hover:file:from-orange-600 hover:file:to-red-700"
                        />
                        {selectedFile && (
                          <div className="flex items-center gap-4">
                            <img
                              src={URL.createObjectURL(selectedFile)}
                              alt="Profile preview"
                              className="w-20 h-20 rounded-full object-cover border-2 border-orange-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setProfileSettings(prev => ({ ...prev, profilePicture: '' }));
                              }}
                              className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-all text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        {!selectedFile && (
                          <img
                            src={profileSettings.profilePicture || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                            alt="Current profile"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
                            }}
                            className="w-20 h-20 rounded-full object-cover border-2 border-zinc-600"
                          />
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mt-2">Upload a square image (recommended: 400x400px, max 5MB)</p>
                    </div>
                  </div>

                  {/* Gaming Information Section */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white">Gaming Profile</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Primary Game ID</label>
                        {user?.gameIds?.find(g => g.isPrimary) ? (
                          <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 flex items-center justify-between">
                            <span className="text-white">{user.gameIds.find(g => g.isPrimary).inGameName}</span>
                            <a
                              href="/my-game-ids"
                              className="text-xs text-orange-400 hover:text-orange-300 underline"
                            >
                              Manage
                            </a>
                          </div>
                        ) : (
                          <div className="w-full bg-zinc-800/50 border border-orange-500/40 rounded-lg px-4 py-2 flex items-center justify-between">
                            <span className="text-zinc-500 text-sm">No primary game ID set</span>
                            <a
                              href="/my-game-ids"
                              className="text-xs text-orange-400 hover:text-orange-300 underline"
                            >
                              Add one
                            </a>
                          </div>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">Manage your game IDs on the Game IDs page</p>
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Primary Game</label>
                        <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-400 flex items-center gap-2 cursor-not-allowed select-none">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-white">BGMI</span>
                          <span className="ml-auto text-xs text-zinc-500">Fixed</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-medium mb-3">In-Game Role</label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {['Assaulter', 'IGL', 'Support', 'Fragger', 'Sniper'].map(role => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => {
                              const newRoles = profileSettings.inGameRole.includes(role)
                                ? profileSettings.inGameRole.filter(r => r !== role)
                                : [...profileSettings.inGameRole, role];
                              setProfileSettings({ ...profileSettings, inGameRole: newRoles });
                            }}
                            className={`px-4 py-2 rounded-lg border transition-all ${profileSettings.inGameRole.includes(role)
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                              : 'bg-zinc-800/50 border-zinc-600 text-zinc-300 hover:border-zinc-500'
                              }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Team & Goals Section */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white">Team & Goals</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Team Status *</label>
                        <select
                          value={profileSettings.teamStatus}
                          onChange={(e) => setProfileSettings({ ...profileSettings, teamStatus: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                        >
                          <option value="">Select Status</option>
                          <option value="looking for a team">Looking for a team</option>
                          <option value="in a team">In a team</option>
                          <option value="open for offers">Open for offers</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Availability *</label>
                        <select
                          value={profileSettings.availability}
                          onChange={(e) => setProfileSettings({ ...profileSettings, availability: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                        >
                          <option value="">Select Availability</option>
                          <option value="weekends only">Weekends only</option>
                          <option value="evenings">Evenings</option>
                          <option value="flexible">Flexible</option>
                          <option value="full time">Full time</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Social & Contact Section */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white">Social & Contact</h3>

                    <div>
                      <label className="block text-zinc-300 font-medium mb-2">Discord Tag</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400">#</span>
                        <input
                          type="text"
                          value={profileSettings.discordTag}
                          onChange={(e) => setProfileSettings({ ...profileSettings, discordTag: e.target.value })}
                          placeholder="username#1234"
                          className="w-full pl-12 pr-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Instagram</label>
                        <input
                          type="text"
                          value={profileSettings.instagram}
                          onChange={(e) => setProfileSettings({ ...profileSettings, instagram: e.target.value })}
                          placeholder="instagram.com/username"
                          className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">YouTube</label>
                        <input
                          type="text"
                          value={profileSettings.YouTube}
                          onChange={(e) => setProfileSettings({ ...profileSettings, YouTube: e.target.value })}
                          placeholder="youtube.com/@username"
                          className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-medium mb-3">Profile Visibility</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { value: 'public', label: 'Public', desc: 'Anyone can view your profile' },
                          { value: 'friends', label: 'Friends Only', desc: 'Only friends can see details' },
                          { value: 'private', label: 'Private', desc: 'Hidden from searches' }
                        ].map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setProfileSettings({ ...profileSettings, profileVisibility: option.value })}
                            className={`p-4 rounded-xl border transition-all text-left ${profileSettings.profileVisibility === option.value
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                              : 'bg-zinc-800/50 border-zinc-600 text-zinc-300 hover:border-zinc-500'
                              }`}
                          >
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-zinc-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6 border-t border-zinc-700">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className={`bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${isSaving ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                    <button className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white font-medium px-6 py-2 rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Removed Linked Accounts Section */}

            {/* Removed Notifications Section */}



            {/* Privacy & Security Section */}
            {activeSection === 'privacy' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Shield className="w-6 h-6 text-orange-400" />
                  Privacy & Security
                </h2>

                <div className="space-y-6">
                  <div className="bg-zinc-800/50 border border-amber-400/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Change Password
                    </h3>
                    <div className="space-y-4">
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder="New Password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                      />
                      <button
                        onClick={handleUpdatePassword}
                        disabled={isUpdatingPassword}
                        className={`bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${isUpdatingPassword ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        {isUpdatingPassword ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            Updating...
                          </>
                        ) : 'Update Password'}
                      </button>
                    </div>
                  </div>


                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Privacy Controls</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">Profile Visibility</div>
                          <div className="text-zinc-400 text-sm">Who can view your profile</div>
                        </div>
                        <select className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none">
                          <option value="public">Public</option>
                          <option value="friends">Friends Only</option>
                          <option value="private">Private</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Removed Data & Export Section */}

            {/* Support & Help Section */}
            {activeSection === 'support' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <HelpCircle className="w-6 h-6 text-orange-400" />
                  Support & Help
                </h2>

                <div className="space-y-6">

                  {/* Contact Support */}
                  <div className="bg-zinc-800/50 border border-blue-400/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Contact Support
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Subject</label>
                        <input
                          type="text"
                          placeholder="Brief description of your issue"
                          value={supportSubject}
                          onChange={(e) => setSupportSubject(e.target.value)}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Category</label>
                        <select
                          value={supportCategory}
                          onChange={(e) => setSupportCategory(e.target.value)}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option>Account Issues</option>
                          <option>Technical Problems</option>
                          <option>Billing & Payments</option>
                          <option>Feature Requests</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Message</label>
                        <textarea
                          placeholder="Describe your issue in detail..."
                          rows={4}
                          value={supportMessage}
                          onChange={(e) => setSupportMessage(e.target.value)}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none resize-none"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!supportSubject || !supportCategory || !supportMessage) {
                            toast.error('Please fill all fields in Contact Support');
                            return;
                          }
                          setIsSubmittingSupport(true);
                          try {
                            const response = await axiosInstance.post('/api/support/contact', {
                              subject: supportSubject,
                              category: supportCategory,
                              message: supportMessage,
                            });
                            if (response.status === 200) {
                              toast.success('Support request submitted successfully');
                              setSupportSubject('');
                              setSupportCategory('Account Issues');
                              setSupportMessage('');
                            } else {
                              const errorData = response.data;
                              toast.error(errorData.message || 'Failed to submit support request');
                            }
                          } catch (error) {
                            toast.error('Failed to submit support request');
                          } finally {
                            setIsSubmittingSupport(false);
                          }
                        }}
                        disabled={isSubmittingSupport}
                        className={`bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${isSubmittingSupport ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        Send Message
                      </button>
                    </div>
                  </div>

                  {/* Report a Bug */}
                  <div className="bg-zinc-800/50 border border-red-400/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                      <Bug className="w-5 h-5" />
                      Report a Bug
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Bug Title</label>
                        <input
                          type="text"
                          placeholder="Short description of the bug"
                          value={bugTitle}
                          onChange={(e) => setBugTitle(e.target.value)}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Steps to Reproduce</label>
                        <textarea
                          placeholder="1. Go to...&#10;2. Click on...&#10;3. Expected vs Actual result..."
                          rows={4}
                          value={bugSteps}
                          onChange={(e) => setBugSteps(e.target.value)}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Priority</label>
                        <select
                          value={bugPriority}
                          onChange={(e) => setBugPriority(e.target.value)}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none"
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          <option>Critical</option>
                        </select>
                      </div>
                      <button
                        onClick={async () => {
                          if (!bugTitle || !bugSteps) {
                            toast.error('Please fill all required fields in Bug Report');
                            return;
                          }
                          setIsSubmittingBug(true);
                          try {
                            const response = await axiosInstance.post('/api/support/bug', {
                              title: bugTitle,
                              stepsToReproduce: bugSteps,
                              priority: bugPriority,
                            });
                            if (response.status === 200) {
                              toast.success('Bug report submitted successfully');
                              setBugTitle('');
                              setBugSteps('');
                              setBugPriority('Low');
                            } else {
                              const errorData = response.data;
                              toast.error(errorData.message || 'Failed to submit bug report');
                            }
                          } catch (error) {
                            toast.error('Failed to submit bug report');
                          } finally {
                            setIsSubmittingBug(false);
                          }
                        }}
                        disabled={isSubmittingBug}
                        className={`bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${isSubmittingBug ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                      >
                        <Bug className="w-4 h-4" />
                        Submit Bug Report
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">FAQ</h3>
                    <div className="space-y-4">
                      {faqData.map((faq, index) => (
                        <div key={index} className="border-b border-zinc-700 pb-4 last:border-0 last:pb-0">
                          <button
                            onClick={() => setOpenFaq(openFaq === index ? null : index)}
                            className="w-full flex items-center justify-between text-left group"
                          >
                            <span className="text-white font-medium group-hover:text-orange-400 transition-colors">
                              {faq.question}
                            </span>
                            <ChevronRight
                              className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${openFaq === index ? 'rotate-90 text-orange-400' : ''}`}
                            />
                          </button>
                          <div
                            className={`overflow-hidden transition-all duration-300 ${openFaq === index ? 'max-h-40 mt-3' : 'max-h-0'}`}
                          >
                            <p className="text-zinc-400 text-sm leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>


    </div>
  );
};

export default SettingsComponent;