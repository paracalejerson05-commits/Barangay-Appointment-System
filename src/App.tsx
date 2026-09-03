/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Layout } from './components/Layout';
import { ResidentDashboard } from './components/ResidentDashboard';
import { ResidentServices } from './components/ResidentServices';
import { ResidentRequests } from './components/ResidentRequests';
import { AdminDashboard } from './components/AdminDashboard';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { Loader2 } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot for real-time updates
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
            setUser(firebaseUser);
          } else {
            setUser(firebaseUser);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile snapshot error:", error);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleAuthSuccess = (user: User, profile: any) => {
    setUser(user);
    setUserProfile(profile);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <BrowserRouter>
      <Layout user={user} profile={userProfile} onLogout={handleLogout}>
        <Routes>
          {userProfile?.role === 'admin' ? (
            <>
              <Route path="/" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/requests" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/residents" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/reports" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/schedule" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/settings" element={<Settings user={user} profile={userProfile} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<ResidentDashboard user={user} profile={userProfile} />} />
              <Route path="/services" element={<ResidentServices user={user} profile={userProfile} />} />
              <Route path="/requests" element={<ResidentRequests user={user} profile={userProfile} />} />
              <Route path="/settings" element={<Settings user={user} profile={userProfile} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
