import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  User, Shield, HelpCircle,
  Bug, MessageSquare, Trash2, ExternalLink,
  Save, X, Check, AlertTriangle, Globe,
  Lock, Key, Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/axiosConfig';

const SettingsComponent = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    inGameName: '',
    primaryGame: 'BGMI',
    earnings: '',
    inGameRole: [],

    // Team & Goals
    teamStatus: '',
    availability: '',

    // Social & Contact
    discordTag: '',
    twitch: '',
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
        country: 'India',
        bio: user.bio || '',
        languages: user.languages || [],
        profilePicture: user.profilePicture || '',
        inGameName: user.inGameName || '',
        primaryGame: 'BGMI',
        earnings: user.earnings || '',
        inGameRole: user.inGameRole || [],
        teamStatus: user.teamStatus || '',
        availability: user.availability || '',
        discordTag: user.discordTag || '',
        twitch: user.twitch || '',
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
      const response = await axiosInstance.put('/api/players/update-profile', profileSettings);
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

  const handleForgotPassword = async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) {
      alert('Please enter your registered email.');
      return;
    }

    try {
      const response = await axiosInstance.post('/api/forgot-password', { email });
      alert(response.data.message);
    } catch (err) {
      alert(err?.error || err?.message || 'Server error.');
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
                <SettingsSection
                  id="danger"
                  title="Account Deletion"
                  icon={Trash2}
                  isActive={activeSection === 'danger'}
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
                        <label className="block text-zinc-300 font-medium mb-2">Country *</label>
                        <input
                          type="text"
                          value="India"
                          disabled
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white opacity-60 cursor-not-allowed"
                        />
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
                        {profileSettings.profilePicture && !selectedFile && (
                          <img
                            src={profileSettings.profilePicture}
                            alt="Current profile"
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
                        <label className="block text-zinc-300 font-medium mb-2">In-Game Name</label>
                        <input
                          type="text"
                          value={profileSettings.inGameName}
                          onChange={(e) => setProfileSettings({ ...profileSettings, inGameName: e.target.value })}
                          placeholder="Your in-game username"
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-2">Primary Game *</label>
                        <input
                          type="text"
                          value="BGMI"
                          disabled
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white opacity-60 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-medium mb-3">In-Game Role</label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {['assaulter', 'IGL', 'support', 'filter', 'sniper'].map(role => (
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
                        <label className="block text-zinc-300 font-medium mb-2">Twitch</label>
                        <input
                          type="text"
                          value={profileSettings.twitch}
                          onChange={(e) => setProfileSettings({ ...profileSettings, twitch: e.target.value })}
                          placeholder="twitch.tv/username"
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
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder="New Password"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                      />
                      <button className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2 rounded-lg transition-colors">
                        Update Password
                      </button>
                    </div>
                  </div>

                  {/*Forgot Passwrod section*/}
                  <div className="bg-zinc-800/50 border border-amber-400/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Forgot Password
                    </h3>
                    <div className="space-y-4">
                      <input
                        type="email"
                        placeholder="Enter your registered email"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                        id="forgotEmail"
                      />
                      <button
                        onClick={handleForgotPassword}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        Send Reset Link
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-blue-400/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Two-Factor Authentication
                    </h3>
                    <p className="text-zinc-400 text-sm mb-4">
                      Add an extra layer of security to your account with 2FA
                    </p>
                    <button className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                      Enable 2FA
                    </button>
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

                  {/* Help Resources */}
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Help Resources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <a
                        href="#"
                        className="flex items-center gap-3 p-3 bg-zinc-700/50 hover:bg-zinc-600/50 rounded-lg transition-colors group"
                      >
                        <HelpCircle className="w-5 h-5 text-orange-400" />
                        <div>
                          <div className="text-white font-medium group-hover:text-orange-400 transition-colors">FAQ</div>
                          <div className="text-zinc-400 text-sm">Frequently asked questions</div>
                        </div>
                      </a>

                      <a
                        href="#"
                        className="flex items-center gap-3 p-3 bg-zinc-700/50 hover:bg-zinc-600/50 rounded-lg transition-colors group"
                      >
                        <Globe className="w-5 h-5 text-blue-400" />
                        <div>
                          <div className="text-white font-medium group-hover:text-blue-400 transition-colors">Help Center</div>
                          <div className="text-zinc-400 text-sm">Complete documentation</div>
                        </div>
                      </a>

                      <a
                        href="#"
                        className="flex items-center gap-3 p-3 bg-zinc-700/50 hover:bg-zinc-600/50 rounded-lg transition-colors group"
                      >
                        <MessageSquare className="w-5 h-5 text-green-400" />
                        <div>
                          <div className="text-white font-medium group-hover:text-green-400 transition-colors">Community</div>
                          <div className="text-zinc-400 text-sm">Join our Discord server</div>
                        </div>
                      </a>

                      <a
                        href="#"
                        className="flex items-center gap-3 p-3 bg-zinc-700/50 hover:bg-zinc-600/50 rounded-lg transition-colors group"
                      >
                        <ExternalLink className="w-5 h-5 text-purple-400" />
                        <div>
                          <div className="text-white font-medium group-hover:text-purple-400 transition-colors">Status Page</div>
                          <div className="text-zinc-400 text-sm">Service status updates</div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Account Deletion Section */}
            {activeSection === 'danger' && (
              <div className="bg-zinc-900/50 border border-red-500/50 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-3">
                  <Trash2 className="w-6 h-6" />
                  Danger Zone
                </h2>

                <div className="space-y-6">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                      <h3 className="text-xl font-semibold text-red-400">Delete Account</h3>
                    </div>

                    <div className="space-y-4 mb-6">
                      <p className="text-zinc-300">
                        Once you delete your account, there is no going back. This action cannot be undone.
                      </p>

                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                        <h4 className="text-red-400 font-medium mb-2">This will permanently delete:</h4>
                        <ul className="text-zinc-300 text-sm space-y-1 list-disc list-inside">
                          <li>Your profile and all personal information</li>
                          <li>All match history and statistics</li>
                          <li>Tournament participation records</li>
                          <li>Friend connections and messages</li>
                          <li>Achievement progress and rewards</li>
                          <li>Any premium features or subscriptions</li>
                        </ul>
                      </div>
                    </div>

                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete My Account
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-red-800/50 border border-red-500/50 rounded-lg p-4">
                          <p className="text-red-300 font-medium mb-3">
                            Are you absolutely sure? This action cannot be undone.
                          </p>
                          <div className="mb-4">
                            <label className="block text-red-300 text-sm font-medium mb-2">
                              Type "DELETE" to confirm:
                            </label>
                            <input
                              type="text"
                              placeholder="DELETE"
                              className="w-full bg-red-900/50 border border-red-500/50 rounded-lg px-4 py-2 text-white focus:border-red-400 focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-3">
                            <button className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2">
                              <Trash2 className="w-4 h-4" />
                              Permanently Delete Account
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(false)}
                              className="bg-zinc-600 hover:bg-zinc-500 text-white font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <h4 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Alternative Options
                    </h4>
                    <p className="text-amber-300 text-sm mb-3">
                      Before deleting your account permanently, consider these alternatives:
                    </p>
                    <div className="space-y-2">
                      <button className="w-full bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 font-medium px-4 py-2 rounded-lg transition-colors text-left">
                        Temporarily Deactivate Account
                      </button>
                      <button className="w-full bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 font-medium px-4 py-2 rounded-lg transition-colors text-left">
                        Download Account Data First
                      </button>
                      <button className="w-full bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 font-medium px-4 py-2 rounded-lg transition-colors text-left">
                        Contact Support for Help
                      </button>
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