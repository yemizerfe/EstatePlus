import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

/**
 * PageLoader
 * Shows a full-screen loading overlay briefly while the route is changing.
 * The short delay keeps the spinner from flashing on instantaneous
 * navigations while still giving feedback on slower transitions.
 */
const PageLoader = () => {
  const [loading, setLoading] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;
  return <LoadingSpinner label="Loading..." overlay size={56} />;
};

export default PageLoader;
