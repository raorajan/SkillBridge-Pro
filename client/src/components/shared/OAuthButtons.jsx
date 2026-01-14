import React from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {Button,Input} from "../../components"

const OAuthButtons = ({ onOAuthClick, className = "" }) => {
  const [searchParams] = useSearchParams();
  
  // Get redirect URL from query parameters
  const redirectTo = searchParams.get('redirect_to');
  const oauthProviders = [
    {
      id: "github",
      icon: Github,
      label: "GitHub",
      size: 16
    },
    {
      id: "google", 
      icon: Mail,
      label: "Google",
      size: 16
    },
    {
      id: "linkedin",
      icon: Linkedin,
      label: "LinkedIn", 
      size: 16
    }
  ];

  const handleOAuthClick = (provider) => {
    // Build OAuth URL with redirect parameter if present
    let oauthUrl = `${import.meta.env.VITE_API_URL}api/v1/auth/${provider}`;
    
    if (redirectTo) {
      // Add redirect parameter to OAuth URL
      const redirectParam = encodeURIComponent(redirectTo);
      oauthUrl += `?redirect_to=${redirectParam}`;
    }
    
    window.location.href = oauthUrl;
    if (onOAuthClick) onOAuthClick(provider);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <div className='w-full border-t border-white/20'></div>
        </div>
        <div className='relative flex justify-center text-sm'>
          <span className='bg-gray-900 px-3 text-gray-400'>
            Or continue with
          </span>
        </div>
      </div>
      
      <div className='grid grid-cols-3 gap-3'>
        {oauthProviders.map((provider) => {
          const IconComponent = provider.icon;
          return (
            <Button
              key={provider.id}
              type='button'
              onClick={() => handleOAuthClick(provider.id)}
              className='flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all border border-white/10 hover:border-white/20'
            >
              <IconComponent size={provider.size} />
              <span className='hidden sm:inline'>{provider.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default OAuthButtons;
