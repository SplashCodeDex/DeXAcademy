/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef, useState } from 'react';
import { AdShowRequest } from '../services/adService';
import { X } from 'lucide-react';

/**
 * RealAdOverlay: Uses Google's Interactive Media Ads (IMA) SDK.
 * This connects to a real Ad Server and plays VAST-compliant video ads.
 * We use Google's Sample VAST Tag for demonstration (serves real sample ads).
 */
export const AdOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [callback, setCallback] = useState<((success: boolean) => void) | null>(null);
  
  const adContainerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  
  // IMA SDK Objects
  const adsLoaderRef = useRef<any>(null);
  const adsManagerRef = useRef<any>(null);

  useEffect(() => {
    // 1. Initialize IMA SDK on component mount
    if (window.google && window.google.ima) {
       // SDK Loaded via index.html
    }

    const handleRequest = (e: Event) => {
      const customEvent = e as CustomEvent<AdShowRequest>;
      if (customEvent.detail) {
        setCallback(() => customEvent.detail.onComplete);
        setIsVisible(true);
        // Defer execution to allow DOM to render
        setTimeout(() => startAd(), 100);
      }
    };
    
    // Safety Force Close Listener
    const handleForceClose = () => {
        if (isVisible) {
            console.warn("Forced Ad Closure");
            closeAd(false);
        }
    };

    window.addEventListener('mockup_studio_show_ad', handleRequest);
    window.addEventListener('mockup_studio_close_ad', handleForceClose);
    
    return () => {
        window.removeEventListener('mockup_studio_show_ad', handleRequest);
        window.removeEventListener('mockup_studio_close_ad', handleForceClose);
    };
  }, [isVisible]); // Re-bind if visibility changes to ensure closure logic works

  // Window resize handling
  useEffect(() => {
    const handleResize = () => {
        if (adsManagerRef.current && adContainerRef.current) {
            adsManagerRef.current.resize(
                adContainerRef.current.clientWidth,
                adContainerRef.current.clientHeight,
                window.google.ima.ViewMode.NORMAL
            );
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startAd = () => {
      if (!window.google || !window.google.ima) {
          console.error("Google IMA SDK not loaded");
          closeAd(false);
          return;
      }

      // Initialize AdDisplayContainer
      // Important: The video element must be visible in the DOM (even if obscured) for initialization to measure dimensions correctly.
      const adDisplayContainer = new window.google.ima.AdDisplayContainer(
          adContainerRef.current,
          videoElementRef.current
      );
      adDisplayContainer.initialize();

      // Create AdsLoader
      if (adsLoaderRef.current) adsLoaderRef.current.destroy();
      adsLoaderRef.current = new window.google.ima.AdsLoader(adDisplayContainer);
      
      // Add Event Listeners
      adsLoaderRef.current.addEventListener(
          window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
          onAdsManagerLoaded,
          false
      );
      adsLoaderRef.current.addEventListener(
          window.google.ima.AdErrorEvent.Type.AD_ERROR,
          onAdError,
          false
      );

      // Request Ads - Using Google's Sample VAST Tag (Real Ad Server Request)
      const adsRequest = new window.google.ima.AdsRequest();
      adsRequest.adTagUrl = 'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=';
      
      adsRequest.linearAdSlotWidth = adContainerRef.current!.clientWidth;
      adsRequest.linearAdSlotHeight = adContainerRef.current!.clientHeight;
      adsRequest.nonLinearAdSlotWidth = adContainerRef.current!.clientWidth;
      adsRequest.nonLinearAdSlotHeight = adContainerRef.current!.clientHeight / 3;

      adsLoaderRef.current.requestAds(adsRequest);
  };

  const onAdsManagerLoaded = (adsManagerLoadedEvent: any) => {
      const adsRenderingSettings = new window.google.ima.AdsRenderingSettings();
      adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;

      adsManagerRef.current = adsManagerLoadedEvent.getAdsManager(videoElementRef.current!, adsRenderingSettings);

      adsManagerRef.current.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, onAdError);
      
      // Events to track completion
      adsManagerRef.current.addEventListener(window.google.ima.AdEvent.Type.COMPLETE, () => closeAd(true));
      adsManagerRef.current.addEventListener(window.google.ima.AdEvent.Type.SKIPPED, () => closeAd(false));
      adsManagerRef.current.addEventListener(window.google.ima.AdEvent.Type.USER_CLOSE, () => closeAd(false));

      try {
          adsManagerRef.current.init(
              adContainerRef.current!.clientWidth,
              adContainerRef.current!.clientHeight,
              window.google.ima.ViewMode.NORMAL
          );
          adsManagerRef.current.start();
      } catch (adError) {
          console.error("Ad Playback Error", adError);
          onAdError(null);
      }
  };

  const onAdError = (adErrorEvent: any) => {
      console.error(adErrorEvent?.getError());
      if (adsManagerRef.current) adsManagerRef.current.destroy();
      closeAd(false);
  };

  const closeAd = (success: boolean) => {
      if (adsManagerRef.current) {
          adsManagerRef.current.destroy();
          adsManagerRef.current = null;
      }
      setIsVisible(false);
      if (callback) {
          callback(success);
          setCallback(null);
      }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center">
       {/* Close Button (Failsafe) */}
       <button 
         onClick={() => closeAd(false)}
         className="absolute top-4 right-4 z-[1010] bg-white/20 p-2 rounded-full text-white hover:bg-white/40"
       >
         <X size={24} />
       </button>

       {/* Ad Container for IMA SDK */}
       <div 
          ref={adContainerRef} 
          className="w-full h-full relative bg-black flex items-center justify-center"
       >
           {/* Video element must be visible to DOM logic (dimensions) but we can position it absolutely to fill container */}
           <video 
              ref={videoElementRef} 
              className="absolute inset-0 w-full h-full"
           />
       </div>
    </div>
  );
};