/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { dbGetUserById } from './lib/supabaseDb';
import { Layout } from './components/Layout';
import { ResidentDashboard } from './components/ResidentDashboard';
import { ResidentServices } from './components/ResidentServices';
import { ResidentRequests } from './components/ResidentRequests';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminManagement } from './components/AdminManagement';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { Loader2 } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isPrimaryAdmin } from './lib/adminAccess';
import { checkProfileCompletion } from './lib/profileUtils';

function hasSocialIdentity(authUser: any) {
  return ['google', 'facebook'].includes(authUser?.app_metadata?.provider)
    || (authUser?.identities || []).some((identity: any) => ['google', 'facebook'].includes(identity.provider));
}

function getProviderPhoto(authUser: any) {
  const metadata = authUser?.user_metadata || {};
  return metadata.photoURL || metadata.avatar_url || metadata.picture || null;
}

function reportOAuthIssue(message: string) {
  try {
    window.sessionStorage.setItem('resident-oauth-error', message);
  } catch {
    // The login view can still handle the missing-email state without storage.
  }
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const authUser = session.user;
          if (hasSocialIdentity(authUser) && (!authUser.email || !(authUser.email_confirmed_at || authUser.confirmed_at))) {
            reportOAuthIssue(authUser.email
              ? 'Your social provider did not return a verified email address. Verify your provider email or use another sign-in method.'
              : 'Facebook did not provide an email address. Allow email access in Facebook or use another sign-in method.');
            await supabase.auth.signOut();
            return;
          }
          const { error: invitationError } = await supabase.rpc('complete_admin_invitation');
          if (invitationError) {
            console.error('Could not complete an administrator invitation:', invitationError.message);
          }
          const mappedUser = {
            uid: authUser.id,
            email: authUser.email,
            displayName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0],
            photoURL: getProviderPhoto(authUser),
            user_metadata: authUser.user_metadata
          };

          let profile = await dbGetUserById(authUser.id);
          mappedUser.photoURL = mappedUser.photoURL || profile?.photo_url || profile?.photoURL || null;
          if (!profile && authUser.email) {
            const { data: matchingProfile, error: emailLookupError } = await supabase
              .from('users')
              .select('*')
              .eq('email', authUser.email)
              .maybeSingle();
            if (!emailLookupError && matchingProfile && matchingProfile.id !== authUser.id) {
              reportOAuthIssue('An account already uses this email address. Sign in with that account to link this provider.');
              await supabase.auth.signOut();
              return;
            }
            if (matchingProfile) profile = matchingProfile;
          }
          if (!profile) {
            const isAdmin = !hasSocialIdentity(authUser) && authUser.email?.toLowerCase() === 'paracalejerson05@gmail.com';
            profile = {
              uid: authUser.id,
              id: authUser.id,
              email: authUser.email,
              displayName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Resident',
              role: isAdmin ? 'admin' : 'resident',
              status: isAdmin ? 'approved' : 'pending',
              createdAt: new Date().toISOString()
            };
            await supabase.from('users').upsert(profile);
          }
          setUser(mappedUser);
          setUserProfile(profile);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const authUser = session.user;
        if (hasSocialIdentity(authUser) && (!authUser.email || !(authUser.email_confirmed_at || authUser.confirmed_at))) {
          reportOAuthIssue(authUser.email
            ? 'Your social provider did not return a verified email address. Verify your provider email or use another sign-in method.'
            : 'Facebook did not provide an email address. Allow email access in Facebook or use another sign-in method.');
          setUser(null);
          setUserProfile(null);
          window.setTimeout(() => { void supabase.auth.signOut(); }, 0);
        } else {
          const profile = await dbGetUserById(authUser.id);
          setUser({
            uid: authUser.id,
            email: authUser.email,
            displayName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0],
            photoURL: getProviderPhoto(authUser) || profile?.photo_url || profile?.photoURL || null,
            user_metadata: authUser.user_metadata
          });
          if (profile) setUserProfile(profile);
          window.setTimeout(() => {
            void (async () => {
              const { data: invitationCompleted, error: invitationError } = await supabase.rpc('complete_admin_invitation');
              if (invitationError) {
                console.error('Could not complete an administrator invitation:', invitationError.message);
                return;
              }
              if (invitationCompleted) {
                const updatedProfile = await dbGetUserById(authUser.id);
                if (updatedProfile) setUserProfile(updatedProfile);
              }
            })();
          }, 0);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = (authUser: any, profile: any) => {
    setUser(authUser);
    setUserProfile(profile);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
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

  const needsResidentRegistration = Boolean(
    user
    && userProfile
    && userProfile.role !== 'admin'
    && !checkProfileCompletion(userProfile, user.email).isComplete
  );
  const residentApprovalPending = Boolean(
    user
    && userProfile
    && userProfile.role !== 'admin'
    && checkProfileCompletion(userProfile, user.email).isComplete
    && !(
      ['approved', 'active'].includes(String(userProfile.status || '').toLowerCase())
      && String(userProfile.verification_status || '').toLowerCase() === 'approved'
    )
  );

  if (!user || !userProfile || needsResidentRegistration || residentApprovalPending) {
    return (
      <Auth
        onAuthSuccess={handleAuthSuccess}
        registrationUser={user && (needsResidentRegistration || !userProfile) ? user : undefined}
        existingProfile={userProfile}
        pendingApprovalEmail={residentApprovalPending ? user?.email || undefined : undefined}
      />
    );
  }

  return (
    <BrowserRouter>
      <Layout user={user} profile={userProfile} onLogout={handleLogout}>
        <Routes>
          {userProfile?.role === 'admin' && userProfile?.status !== 'deactivated' ? (
            <>
              <Route path="/" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/requests" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/residents" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/reports" element={<AdminDashboard user={user} profile={userProfile} />} />
              <Route path="/schedule" element={<AdminDashboard user={user} profile={userProfile} />} />
              {isPrimaryAdmin(user.email) && <Route path="/admins" element={<AdminManagement user={user} />} />}
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
