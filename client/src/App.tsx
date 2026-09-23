import { useEffect, useState } from 'react';
import { Backdrop, ConnectionBanner, Toasts } from './components/Chrome';
import { ResetPasswordScreen } from './components/Account';
import { RoleSheetHost } from './components/RoleInfo';
import { session } from './net/session';
import { FatalScreen, Home, JoinCode, JoinFlow, LoadingScreen, ProfileForm } from './screens/Entry';
import { RoomScreen } from './screens/Room';
import { setState, useApp } from './state/store';

type Route = { name: 'home' } | { name: 'create' } | { name: 'code' } | { name: 'join'; code: string } | { name: 'reset' };

function parsePath(): Route {
  const match = window.location.pathname.match(/^\/r\/([A-Za-z0-9]{1,12})\/?$/);
  if (match) return { name: 'join', code: match[1].toUpperCase() };
  if (window.location.pathname === '/reinitialiser') return { name: 'reset' };
  return { name: 'home' };
}

function pathFor(route: Route): string {
  if (route.name === 'reset') return window.location.pathname + window.location.search;
  return route.name === 'join' ? `/r/${route.code}` : '/';
}

function initialRoute(): Route {
  const route = parsePath();
  const tab = session.getTab();
  // Un lien vers un autre salon ouvert dans cet onglet : on suit le lien.
  if (tab && route.name === 'join' && route.code !== tab.code) session.setTab(null);
  return route;
}

export function App() {
  const view = useApp((s) => s.view);
  const fatal = useApp((s) => s.fatal);
  const conn = useApp((s) => s.conn);
  const [route, setRoute] = useState<Route>(initialRoute);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const onPop = () => setRoute(parsePath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Dans un salon, l'adresse reste celle du lien d'invitation : un rafraîchissement y ramène.
  const roomCode = view?.code;
  useEffect(() => {
    if (roomCode && window.location.pathname !== `/r/${roomCode}`) {
      window.history.replaceState(null, '', `/r/${roomCode}`);
    }
  }, [roomCode]);

  const navigate = (next: Route) => {
    const path = pathFor(next);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setRoute(next);
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    setState({ fatal: null });
    navigate({ name: 'home' });
  };

  let content: React.ReactNode;
  if (view) {
    content = <RoomScreen view={view} onLeft={goHome} />;
  } else if (fatal) {
    content = (
      <FatalScreen
        fatal={fatal}
        onHome={goHome}
        onRetry={() => {
          setState({ fatal: null });
          navigate({ name: 'code' });
        }}
      />
    );
  } else if (session.getTab()) {
    content = (
      <LoadingScreen
        label="Retour dans le salon…"
        offline={conn === 'offline'}
        onCancel={() => {
          session.setTab(null);
          forceRender((n) => n + 1);
          goHome();
        }}
      />
    );
  } else {
    switch (route.name) {
      case 'home':
        content = <Home onCreate={() => navigate({ name: 'create' })} onJoin={() => navigate({ name: 'code' })} />;
        break;
      case 'create':
        content = <ProfileForm mode="create" onBack={goHome} />;
        break;
      case 'code':
        content = <JoinCode onBack={goHome} onFound={(code) => navigate({ name: 'join', code })} />;
        break;
      case 'join':
        content = <JoinFlow key={route.code} code={route.code} onBack={goHome} onRetry={() => navigate({ name: 'code' })} />;
        break;
      case 'reset':
        content = <ResetPasswordScreen onHome={goHome} />;
        break;
    }
  }

  return (
    <>
      <Backdrop />
      <ConnectionBanner />
      <main>{content}</main>
      <Toasts />
      <RoleSheetHost />
    </>
  );
}
