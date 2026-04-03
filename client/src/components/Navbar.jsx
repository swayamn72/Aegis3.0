import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, MessageCircle, User, Users, Settings, LogOut, Trophy, Star, Bell, Gamepad2 } from 'lucide-react';
import logo from '../assets/newlogo.png';
import { useAuth } from '../context/AuthContext';
import ProfileDropdown from './ProfileDropdown';
import axios from "axios";

const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const coins = user?.coins || 0;

  const navLinks = [
    { to: "/", text: "Dashboard" },
    { to: "/recruitment", text: "Opportunities" },
    { to: "/tournaments", text: "Tournaments" },
  ];

  const CustomNavLink = ({ to, text }) => {
    const isActive = location.pathname !== '/' && location.pathname === to;
    return (
      <NavLink
        to={to}
        className={`relative text-sm font-semibold uppercase tracking-wider transition-all duration-300 px-3 py-2 rounded-md ${isActive
          ? 'text-white bg-zinc-900/50'
          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
      >
        {text}
        {isActive && (
          <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#FF4500] to-orange-500"></span>
        )}
      </NavLink>
    );
  };

  const MobileNavLink = ({ to, text }) => {
    const isActive = location.pathname !== '/' && location.pathname === to;
    return (
      <NavLink
        to={to}
        onClick={() => setIsOpen(false)}
        className={`block text-sm font-semibold uppercase tracking-wider transition-all duration-300 py-3 px-4 rounded-md ${isActive
          ? 'text-white bg-zinc-900/50'
          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
      >
        {text}
      </NavLink>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-zinc-900">

      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FF4500]/50 to-transparent"></div>

      <div className="container mx-auto flex items-center justify-between h-20 px-6">

        {/* Logo */}
        <NavLink to="/" className="flex items-center shrink-0">
          <img src={logo} alt="Aegis Logo" className="h-[110px] w-auto object-contain transition-transform duration-300 hover:scale-105" />
        </NavLink>

        {/* Nav Links - Desktop */}
        <nav className="hidden md:flex items-center gap-2">
          {navLinks.map(link => <CustomNavLink key={link.text} {...link} />)}
        </nav>

        {/* Right Section - Desktop */}
        <div className="hidden md:flex items-center gap-4">

          {/* Notifications & Chat */}
          <div className="flex items-center gap-3 pr-4 border-r border-zinc-800">
            {isAuthenticated && (
              <button
                onClick={() => navigate('/chat')}
                className="text-zinc-400 hover:text-white transition-all duration-300 p-2 rounded-lg hover:bg-zinc-900/50"
                aria-label="Chat"
                title="Chat"
              >
                <MessageCircle size={20} />
              </button>
            )}
          </div>

          {/* Auth Buttons or Profile */}
          {!isAuthenticated ? (
            <div className="flex items-center gap-3">
              <NavLink
                to="/login"
                className="font-semibold text-white text-sm px-5 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all duration-300"
              >
                Login
              </NavLink>
              <NavLink
                to="/signup"
                className="font-semibold text-white text-sm px-5 py-2 rounded-lg bg-[#FF4500] hover:bg-[#FF4500]/90 transition-all duration-300 shadow-lg shadow-[#FF4500]/20"
              >
                Sign Up
              </NavLink>
            </div>
          ) : (
            <ProfileDropdown user={user} logout={logout} />
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-white p-2 rounded-lg hover:bg-zinc-900/50 transition-all duration-300"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-black/98 backdrop-blur-xl absolute top-20 left-0 w-full border-t border-zinc-900 shadow-2xl">
          <nav className="flex flex-col items-stretch gap-2 py-6 px-4">
            {navLinks.map(link => <MobileNavLink key={link.text} {...link} />)}

            <div className="flex flex-col items-stretch gap-3 mt-6 pt-6 border-t border-zinc-900">
              {!isAuthenticated ? (
                <>
                  <NavLink
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="w-full font-semibold text-white text-sm px-5 py-3 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all duration-300 text-center"
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/signup"
                    onClick={() => setIsOpen(false)}
                    className="w-full font-semibold text-white text-sm px-5 py-3 rounded-lg bg-[#FF4500] hover:bg-[#FF4500]/90 transition-all duration-300 text-center"
                  >
                    Sign Up
                  </NavLink>
                </>
              ) : (
                <>
                  {/* Mobile Chat Button */}
                  <button
                    onClick={() => {
                      navigate('/chat');
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:text-orange-400 hover:bg-gray-800 transition-all duration-200"
                  >
                    <MessageCircle size={18} />
                    <span className="font-medium">Chat</span>
                  </button>

                  {/* Mobile Profile Menu Items */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800 mt-2">
                    <button
                      onClick={() => {
                        navigate('/my-profile');
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:text-orange-400 hover:bg-gray-800 transition-all duration-200"
                    >
                      <User size={18} />
                      <span className="font-medium">My Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/my-game-ids');
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:text-orange-400 hover:bg-gray-800 transition-all duration-200"
                    >
                      <Gamepad2 size={18} />
                      <span className="font-medium">My Game IDs</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/my-teams');
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:text-orange-400 hover:bg-gray-800 transition-all duration-200"
                    >
                      <Users size={18} />
                      <span className="font-medium">My Teams</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/notifications');
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:text-orange-400 hover:bg-gray-800 transition-all duration-200"
                    >
                      <Bell size={18} />
                      <span className="font-medium">Notifications</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate('/settings');
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:text-orange-400 hover:bg-gray-800 transition-all duration-200"
                    >
                      <Settings size={18} />
                      <span className="font-medium">Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:text-red-400 hover:bg-gray-800 transition-all duration-200 border-t border-gray-700 mt-2"
                    >
                      <LogOut size={18} />
                      <span className="font-medium">Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;