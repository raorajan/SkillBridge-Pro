import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  getSyncStatus,
  getIntegrations,
  connectGitHub,
  connectStackOverflow,
  disconnectIntegration,
  triggerSync,
  getSyncHistory,
  getSyncData,
  getSkillScores,
  clearError,
} from "../slice/portfolioSyncSlice";
import { Badge, Button } from "../../../components";
import { getToken } from "../../../services/utils";
import { 
  Github, 
  Linkedin, 
  FileText, 
  RefreshCw, 
  Settings, 
  Link, 
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Activity,
  Globe,
  Code,
  Database,
  Eye,
  EyeOff,
  Target,
  Brain,
  X
} from "lucide-react";
import SyncStatusCard from "./SyncStatusCard";

// GitHub Token Form Component
const GitHubTokenForm = ({ onConnect, onCancel }) => {
  const [formData, setFormData] = useState({
    accessToken: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.accessToken) {
      onConnect({
        accessToken: formData.accessToken,
        scope: "user:email,repo,read:user",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-gray-300">Personal Access Token *</label>
        <input
          type="password"
          required
          value={formData.accessToken}
          onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
          placeholder="Enter your GitHub Personal Access Token"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">
          Create a token at{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            github.com/settings/tokens
          </a>
          {" "}with repo and user:email scopes
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1 bg-gray-700 hover:bg-gray-600"
        >
          <Github className="w-4 h-4 mr-2" />
          Connect with Token
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

// StackOverflow Connect Form Component
const StackOverflowConnectForm = ({ onConnect, onCancel }) => {
  const [formData, setFormData] = useState({
    userId: "",
    username: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.userId) {
      // StackOverflow public API doesn't require access token for read-only data
      const connectData = {
        userId: formData.userId.trim(),
        username: formData.username?.trim() || formData.userId.trim(),
      };
      console.log("Submitting StackOverflow connection with data:", connectData);
      onConnect(connectData);
    } else {
      console.error("User ID is required");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
        <p className="text-xs text-green-300">
          <strong>Good news!</strong> StackOverflow public data doesn't require an access token. Just provide your User ID from your profile URL.
        </p>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm text-gray-300">User ID *</label>
        <input
          type="text"
          required
          value={formData.userId}
          onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
          placeholder="Enter your StackOverflow user ID (numbers only)"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">
          Find it in your profile URL: <code className="text-blue-400">stackoverflow.com/users/YOUR_USER_ID</code>
          <br />
          Example: If your URL is <code className="text-blue-400">stackoverflow.com/users/123456/username</code>, your User ID is <code className="text-blue-400">123456</code>
        </p>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm text-gray-300">Username (optional)</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          placeholder="Enter your StackOverflow username (optional)"
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400">
          Optional - will use your User ID if not provided
        </p>
      </div>
      
      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1 bg-orange-600 hover:bg-orange-700"
        >
          <Code className="w-4 h-4 mr-2" />
          Connect
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

const DeveloperPortfolioSync = ({ user }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    syncStatus,
    integrations: apiIntegrations,
    syncHistory: apiSyncHistory,
    skillScores,
    loading,
    syncing,
    error,
    message,
  } = useSelector((state) => state.portfolioSync);

  const [autoSync, setAutoSync] = useState(true);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // Load data on component mount
  useEffect(() => {
    if (user?.id) {
      dispatch(getSyncStatus());
      dispatch(getIntegrations());
      dispatch(getSyncHistory(10));
      dispatch(getSkillScores());
    }
  }, [dispatch, user?.id]);

  // Handle OAuth callback status from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const error = urlParams.get("error");

    if (status === "github_connected") {
      // Refresh integrations after successful connection
      dispatch(getIntegrations());
      dispatch(getSyncStatus());
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      // Show error message
      console.error("OAuth error:", error);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [dispatch]);

  // Refresh data after sync
  useEffect(() => {
    if (!syncing && message) {
      // Refresh all data after successful sync
      dispatch(getSyncStatus());
      dispatch(getIntegrations());
      dispatch(getSyncHistory(10));
      dispatch(getSkillScores());
    }
  }, [syncing, message, dispatch]);

  // Transform API data to component format
  const integrations = React.useMemo(() => {
    const baseIntegrations = {
      github: {
        connected: false,
        lastSync: null,
        projects: 0,
        commits: 0,
        stars: 0,
        status: "disconnected",
        skillScore: 0,
        trendingSkills: [],
        username: null,
      },
      stackoverflow: {
        connected: false,
        lastSync: null,
        reputation: 0,
        answers: 0,
        status: "disconnected",
        skillScore: 0,
        trendingSkills: [],
        username: null,
      },
      portfolio: {
        connected: !!user?.portfolioUrl,
        lastSync: null,
        portfolioUrl: user?.portfolioUrl || null,
        portfolioScore: user?.portfolioScore || 0,
        status: user?.portfolioUrl ? "active" : "disconnected",
        skillScore: 0,
        trendingSkills: [],
      },
    };

    // Update from API integrations
    if (apiIntegrations && Array.isArray(apiIntegrations)) {
      apiIntegrations.forEach((integration) => {
        if (integration.platform === "github") {
          baseIntegrations.github = {
            ...baseIntegrations.github,
            connected: true,
            username: integration.username,
            lastSync: integration.lastSync,
            status: "active",
          };
        } else if (integration.platform === "stackoverflow") {
          baseIntegrations.stackoverflow = {
            ...baseIntegrations.stackoverflow,
            connected: true,
            username: integration.username,
            lastSync: integration.lastSync,
            status: "active",
          };
        }
      });
    }

    // Update from sync status
    if (syncStatus?.integrations) {
      if (syncStatus.integrations.github) {
        baseIntegrations.github = {
          ...baseIntegrations.github,
          connected: syncStatus.integrations.github.connected || baseIntegrations.github.connected,
          lastSync: syncStatus.integrations.github.lastSync || baseIntegrations.github.lastSync,
          projects: syncStatus.integrations.github.dataCount || 0,
        };
      }
      if (syncStatus.integrations.stackoverflow) {
        baseIntegrations.stackoverflow = {
          ...baseIntegrations.stackoverflow,
          connected: syncStatus.integrations.stackoverflow.connected || baseIntegrations.stackoverflow.connected,
          lastSync: syncStatus.integrations.stackoverflow.lastSync || baseIntegrations.stackoverflow.lastSync,
          answers: syncStatus.integrations.stackoverflow.dataCount || 0,
        };
      }
      if (syncStatus.integrations.portfolio) {
        baseIntegrations.portfolio = {
          ...baseIntegrations.portfolio,
          connected: syncStatus.integrations.portfolio.connected || baseIntegrations.portfolio.connected,
          lastSync: syncStatus.integrations.portfolio.lastSync || baseIntegrations.portfolio.lastSync,
        };
      }
    }
    
    // Update portfolio from user data
    if (user?.portfolioUrl) {
      baseIntegrations.portfolio = {
        ...baseIntegrations.portfolio,
        connected: true,
        portfolioUrl: user.portfolioUrl,
        portfolioScore: user.portfolioScore || 0,
        status: "active",
      };
    }

    // Update skill scores
    if (skillScores?.skills) {
      const skills = Object.keys(skillScores.skills);
      // Get platform-specific skills
      Object.keys(baseIntegrations).forEach((platform) => {
        // This would need platform-specific skill mapping
        baseIntegrations[platform].trendingSkills = skills.slice(0, 3);
        baseIntegrations[platform].skillScore = skillScores.skills[skills[0]]?.score || 0;
      });
    }

    return baseIntegrations;
  }, [apiIntegrations, syncStatus, skillScores, user]);


  // Transform sync history from API
  const syncHistory = React.useMemo(() => {
    if (!apiSyncHistory || !Array.isArray(apiSyncHistory)) return [];
    return apiSyncHistory.map((history) => ({
      id: history.id,
      timestamp: history.startedAt || history.completedAt,
      status: history.status || "success",
      platform: history.platform,
      itemsUpdated: history.itemsSynced || 0,
      itemsFailed: history.itemsFailed || 0,
      errorMessage: history.errorMessage,
    }));
  }, [apiSyncHistory]);

  // Get skill intelligence from API data
  const skillIntelligence = React.useMemo(() => {
    const skills = skillScores?.skills || {};
    const skillNames = Object.keys(skills);
    
    return {
      overallScore: skillScores?.overallScore || 0,
      trendingSkills: skillNames.slice(0, 5),
      learningPath: skillNames.slice(5, 8).map((skill, index) => ({
        skill,
        priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
        reason: "Based on your portfolio analysis",
      })),
      marketDemand: skillNames.reduce((acc, skill) => {
        acc[skill.toLowerCase()] = skills[skill]?.score || 0;
        return acc;
      }, {}),
    };
  }, [skillScores]);

  const toggleIntegration = async (type) => {
    const integration = integrations[type];
    
    // Portfolio doesn't have connect/disconnect - it uses URL from profile
    if (type === "portfolio") {
      if (!integration.connected || !integration.portfolioUrl) {
        // Navigate to profile to add portfolio URL
        navigate("/profile");
      } else {
        // Sync portfolio
        try {
          await dispatch(triggerSync({ platform: "portfolio" })).unwrap();
          dispatch(getSyncStatus());
          dispatch(getSyncHistory(10));
        } catch (error) {
          console.error("Failed to sync portfolio:", error);
        }
      }
      return;
    }
    
    if (integration.connected) {
      // Disconnect
      try {
        await dispatch(disconnectIntegration(type)).unwrap();
        dispatch(getIntegrations());
        dispatch(getSyncStatus());
      } catch (error) {
        console.error("Failed to disconnect:", error);
      }
    } else {
      // Show connect modal
      setSelectedPlatform(type);
      setShowConnectModal(true);
    }
  };

  const handleConnect = async (platform, data) => {
    try {
      if (platform === "github") {
        await dispatch(connectGitHub(data)).unwrap();
      } else if (platform === "stackoverflow") {
        await dispatch(connectStackOverflow(data)).unwrap();
      }
      setShowConnectModal(false);
      setSelectedPlatform(null);
      dispatch(getIntegrations());
      dispatch(getSyncStatus());
    } catch (error) {
      console.error("Failed to connect:", error);
      // Log full error details for debugging
      console.error("Error details:", {
        message: error?.message,
        response: error?.response,
        data: error?.response?.data,
        status: error?.response?.status,
      });
    }
  };

  const handleSync = async () => {
    try {
      await dispatch(triggerSync({ platform: "all" })).unwrap();
      // Data will be refreshed via useEffect
    } catch (error) {
      console.error("Sync failed:", error);
    }
  };

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const integrationIcon = (type) => {
    switch (type) {
      case "github":
        return <Github className='w-5 h-5 text-white' />;
      case "linkedin":
        return <Linkedin className='w-5 h-5 text-blue-400' />;
      case "stackoverflow":
        return <Code className='w-5 h-5 text-orange-400' />;
      case "portfolio":
        return <Globe className='w-5 h-5 text-purple-400' />;
      default:
        return <FileText className='w-5 h-5 text-gray-400' />;
    }
  };

  const getIntegrationStats = (type, data) => {
    switch (type) {
      case "github":
        if (data.connected) {
          return data.username 
            ? `@${data.username} • ${data.projects || 0} repositories`
            : `Connected • ${data.projects || 0} repositories`;
        }
        return "Not connected";
      case "stackoverflow":
        if (data.connected) {
          return data.username 
            ? `@${data.username} • ${data.answers || 0} answers`
            : `Connected • ${data.answers || 0} answers`;
        }
        return "Not connected";
      case "portfolio":
        if (data.connected && data.portfolioUrl) {
          try {
            const url = new URL(data.portfolioUrl);
            return `${url.hostname} • Score: ${data.portfolioScore || 0}`;
          } catch (e) {
            return `Portfolio URL set • Score: ${data.portfolioScore || 0}`;
          }
        }
        return "No portfolio URL set";
      default:
        return "No data available";
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return "Never";
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const connectedCount = Object.values(integrations).filter(integration => integration.connected).length;
  const totalIntegrations = Object.keys(integrations).length;

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white'>
      <div className='max-w-7xl mx-auto px-4 py-6 sm:py-8'>
        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-300">{error}</span>
            </div>
            <button
              onClick={() => dispatch(clearError())}
              className="text-red-300 hover:text-red-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-300">{message}</span>
            </div>
            <button
              onClick={() => dispatch(clearError())}
              className="text-green-300 hover:text-green-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 backdrop-blur-sm p-6 rounded-2xl border border-white/10 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
                <Link className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className='text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'>
                  PortfolioSync
                </h1>
                <p className="text-gray-300 text-sm">
                  Connect platforms to showcase your work and boost matchmaking accuracy
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg">
                <Brain className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">
                  Skill Score: {skillIntelligence.overallScore}/100
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">
                  {connectedCount}/{totalIntegrations} Connected
                </span>
              </div>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600  transition-all duration-300"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{connectedCount}</p>
                <p className="text-sm text-gray-400">Connected</p>
              </div>
            </div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{skillIntelligence.overallScore}</p>
                <p className="text-sm text-gray-400">Skill Score</p>
              </div>
            </div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{skillIntelligence.trendingSkills.length}</p>
                <p className="text-sm text-gray-400">Trending Skills</p>
              </div>
            </div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {Object.values(integrations).reduce((sum, integration) => 
                    sum + (integration.projects || integration.commits || integration.answers || 0), 0
                  )}
                </p>
                <p className="text-sm text-gray-400">Total Items</p>
              </div>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
          {/* Left Column: Enhanced Integrations */}
          <div className='xl:col-span-2 space-y-6'>
            <section className='bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/10'>
              <div className="flex items-center justify-between mb-6">
                <h2 className='text-xl font-semibold flex items-center gap-2'>
                  <Settings className='w-5 h-5 text-cyan-400' />
                  Platform Integrations
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSyncHistory(!showSyncHistory)}
                  className=" transition-transform duration-300"
                >
                  {showSyncHistory ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {showSyncHistory ? "Hide History" : "Show History"}
                </Button>
              </div>
              
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {Object.entries(integrations).map(([type, data]) => (
                  <div
                    key={type}
                    className={`bg-white/5 border border-white/10 rounded-xl p-4 transition-all duration-300 hover:bg-white/10 group ${
                      data.connected ? "ring-1 ring-green-500/30" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 transition-transform duration-300`}>
                          {integrationIcon(type)}
                        </div>
                        <div>
                          <h3 className="font-medium text-white capitalize">
                            {type.replace(/([A-Z])/g, ' $1').trim()}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {getIntegrationStats(type, data)}
                          </p>
                          {data.connected && data.skillScore > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Brain className="w-3 h-3 text-blue-400" />
                              <span className="text-xs text-blue-400">Score: {data.skillScore}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {type === "portfolio" ? (
                        // Portfolio: Show sync button or link to profile
                        <Button
                          onClick={() => toggleIntegration(type)}
                          size="sm"
                          variant={data.connected ? "default" : "outline"}
                          className={data.connected 
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" 
                            : "border-purple-500 text-purple-400 hover:bg-purple-500/10"
                          }
                        >
                          {data.connected ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Sync
                            </>
                          ) : (
                            <>
                              <Link className="w-3 h-3 mr-1" />
                              Add URL
                            </>
                          )}
                        </Button>
                      ) : (
                        // GitHub/StackOverflow: Show toggle switch
                        <button
                          onClick={() => toggleIntegration(type)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                            data.connected 
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                              : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                              data.connected ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={data.connected ? "success" : "error"}
                          className="text-xs"
                        >
                          {data.connected ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> {type === "portfolio" ? "URL Set" : "Connected"}</>
                          ) : (
                            <><AlertCircle className="w-3 h-3 mr-1" /> {type === "portfolio" ? "No URL" : "Disconnected"}</>
                          )}
                        </Badge>
                      </div>
                      
                      {data.connected && data.lastSync && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(data.lastSync)}
                        </div>
                      )}
                      
                      {type === "portfolio" && data.connected && data.portfolioUrl && (
                        <a
                          href={data.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Visit
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Skill Intelligence */}
            <section className='bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/10'>
              <h2 className='text-xl font-semibold flex items-center gap-2 mb-6'>
                <Brain className='w-5 h-5 text-purple-400' />
                Skill Intelligence
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Trending Skills</h3>
                  <div className="space-y-2">
                    {skillIntelligence.trendingSkills.length === 0 ? (
                      <div className="text-center py-4 text-gray-400">
                        <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No skills data yet</p>
                        <p className="text-xs mt-1">Sync your integrations to see your skills</p>
                      </div>
                    ) : (
                      skillIntelligence.trendingSkills.map((skill, index) => (
                        <div key={skill} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                            <span className="text-white font-medium">{skill}</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {skillIntelligence.marketDemand[skill.toLowerCase()] || 0}% score
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Learning Path</h3>
                  <div className="space-y-2">
                    {skillIntelligence.learningPath.length === 0 ? (
                      <div className="text-center py-4 text-gray-400">
                        <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No learning path yet</p>
                        <p className="text-xs mt-1">Complete more projects to get recommendations</p>
                      </div>
                    ) : (
                      skillIntelligence.learningPath.map((item, index) => (
                        <div key={item.skill} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-medium">{item.skill}</span>
                            <Badge className={
                              item.priority === "high" ? "bg-red-500/20 text-red-400" :
                              item.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-green-500/20 text-green-400"
                            }>
                              {item.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400">{item.reason}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Sync History */}
            {showSyncHistory && (
              <section className='bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/10'>
                <h2 className='text-xl font-semibold flex items-center gap-2 mb-4'>
                  <Database className='w-5 h-5 text-blue-400' />
                  Sync History
                </h2>
                
                <div className="space-y-3">
                  {syncHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No sync history yet</p>
                      <p className="text-xs mt-1">Sync your integrations to see history</p>
                    </div>
                  ) : (
                    syncHistory.slice(0, 10).map((sync) => (
                      <div
                        key={sync.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            sync.status === "success" 
                              ? "bg-green-500/20 text-green-400" 
                              : sync.status === "partial"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {sync.status === "success" ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : sync.status === "partial" ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {sync.status === "success" ? "Sync Successful" : 
                               sync.status === "partial" ? "Partial Sync" : "Sync Failed"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {sync.platform || "All platforms"} • {sync.itemsUpdated || 0} items synced
                              {sync.itemsFailed > 0 && ` • ${sync.itemsFailed} failed`}
                            </p>
                            {sync.errorMessage && (
                              <p className="text-xs text-red-400 mt-1">{sync.errorMessage}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {getTimeAgo(sync.timestamp)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Enhanced Sync Controls */}
          <div className='space-y-6'>
            <SyncStatusCard 
              userData={user} 
              integrations={integrations}
              syncing={syncing}
              autoSync={autoSync}
              setAutoSync={setAutoSync}
              onSync={handleSync}
            />
          </div>
        </div>

        {/* Connect Modal */}
        {showConnectModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">
                  Connect {selectedPlatform === "github" ? "GitHub" : "StackOverflow"}
                </h3>
                <button
                  onClick={() => {
                    setShowConnectModal(false);
                    setSelectedPlatform(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {selectedPlatform === "github" && (
                <div className="space-y-4">
                  <p className="text-gray-300 text-sm">
                    Connect your GitHub account to sync your repositories and commits.
                    Click the button below to authorize through GitHub OAuth.
                  </p>
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        // Get token and redirect to GitHub OAuth
                        const token = getToken();
                        let apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
                        // Ensure trailing slash
                        if (!apiUrl.endsWith('/')) {
                          apiUrl += '/';
                        }
                        const oauthUrl = `${apiUrl}api/v1/user/portfolio-sync/oauth/github${token ? `?token=${encodeURIComponent(token)}` : ''}`;
                        window.location.href = oauthUrl;
                      }}
                      className="w-full bg-gray-700 hover:bg-gray-600"
                    >
                      <Github className="w-4 h-4 mr-2" />
                      Connect with GitHub OAuth
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-slate-800 px-2 text-gray-400">Or</span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs">
                      Alternatively, you can use a GitHub Personal Access Token with repo and user:email scopes.
                    </p>
                    <GitHubTokenForm
                      onConnect={(data) => handleConnect("github", data)}
                      onCancel={() => {
                        setShowConnectModal(false);
                        setSelectedPlatform(null);
                      }}
                    />
                  </div>
                </div>
              )}
              
              {selectedPlatform === "stackoverflow" && (
                <div className="space-y-4">
                  <p className="text-gray-300 text-sm">
                    To connect StackOverflow, you'll need to provide your access token and user ID.
                    You can get these from your StackOverflow developer settings.
                  </p>
                  <StackOverflowConnectForm
                    onConnect={(data) => handleConnect("stackoverflow", data)}
                    onCancel={() => {
                      setShowConnectModal(false);
                      setSelectedPlatform(null);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeveloperPortfolioSync;
