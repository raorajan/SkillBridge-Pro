const {
  CareerRecommendationsModel,
  ResumeSuggestionsModel,
  SkillGapsModel,
  DeveloperMatchesModel,
  ProjectOptimizationsModel,
  SkillTrendsModel,
  PlatformInsightsModel,
  TeamAnalysisModel,
} = require('../models/ai-career.model');

class AICareerService {
  /**
   * Get career recommendations for a developer
   */
  async getCareerRecommendations(userId, userData = {}) {
    try {
      const existing = await CareerRecommendationsModel.getRecommendationsByUserId(userId, 10);
      if (existing && existing.length > 0) {
        return existing.map(rec => ({
          id: rec.id,
          title: rec.title,
          match: `${rec.matchScore}%`,
          description: rec.description,
          icon: rec.icon || "💻",
          skills: rec.skills || [],
          growth: rec.growth,
          salary: rec.salary,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting career recommendations:', error);
      throw error;
    }
  }

  /**
   * Get resume enhancement suggestions
   */
  async getResumeSuggestions(userId, resumeData = {}) {
    try {
      const existing = await ResumeSuggestionsModel.getSuggestionsByUserId(userId, 10);
      if (existing && existing.length > 0) {
        return existing.map(s => ({
          id: s.id,
          text: s.text,
          category: s.category,
          priority: s.priority,
          icon: s.icon || "📊",
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting resume suggestions:', error);
      throw error;
    }
  }

  /**
   * Analyze skill gaps for a developer
   */
  async analyzeSkillGap(userId, userSkills = {}) {
    try {
      const existing = await SkillGapsModel.getSkillGapsByUserId(userId, 10);
      if (existing && existing.length > 0) {
        return existing.map(gap => ({
          skill: gap.skill,
          required: gap.requiredLevel,
          current: gap.currentLevel,
          icon: gap.icon || "🐳",
          category: gap.category,
          gapLevel: gap.gapLevel,
          progress: gap.progress,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error analyzing skill gap:', error);
      throw error;
    }
  }

  /**
   * Match developers for a project
   */
  async matchDevelopers(projectOwnerId, projectId = null, projectData = {}) {
    try {
      const existing = await DeveloperMatchesModel.getMatchesByProjectOwner(projectOwnerId, projectId, 10);
      if (existing && existing.length > 0) {
        return existing.map(match => ({
          id: match.id,
          name: `Developer ${match.developerId}`, // In real app, fetch from user-service
          skills: match.skills || [],
          experience: match.experience,
          match: match.matchScore,
          availability: match.availability,
          rate: match.rate,
          location: match.location,
          icon: "👩‍💻",
          highlights: match.highlights || [],
        }));
      }
      return [];
    } catch (error) {
      console.error('Error matching developers:', error);
      throw error;
    }
  }

  /**
   * Optimize project listing
   */
  async optimizeProject(projectId, projectOwnerId, projectData = {}) {
    try {
      const existing = await ProjectOptimizationsModel.getOptimizationsByProjectId(projectId, 10);
      if (existing && existing.length > 0) {
        return existing.map(opt => ({
          id: opt.id,
          title: opt.title,
          description: opt.description,
          impact: opt.impact,
          category: opt.category,
          icon: opt.icon || "📝",
          suggestions: opt.suggestions || [],
        }));
      }
      return [];
    } catch (error) {
      console.error('Error optimizing project:', error);
      throw error;
    }
  }

  /**
   * Get skill trends (for admins)
   */
  async getSkillTrends() {
    try {
      const existing = await SkillTrendsModel.getAllTrends(20);
      if (existing && existing.length > 0) {
        return existing.map(trend => ({
          id: trend.id,
          skill: trend.skill,
          demand: trend.demand,
          growth: trend.growth,
          trend: trend.trend,
          icon: trend.icon || "⚛️",
          category: trend.category,
          projects: trend.projectsCount,
          developers: trend.developersCount,
          color: trend.color,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting skill trends:', error);
      throw error;
    }
  }

  /**
   * Get platform insights (for admins)
   */
  async getPlatformInsights() {
    try {
      const existing = await PlatformInsightsModel.getAllInsights(20);
      if (existing && existing.length > 0) {
        return existing.map(insight => ({
          id: insight.id,
          title: insight.title,
          description: insight.description,
          impact: insight.impact,
          recommendation: insight.recommendation,
          icon: insight.icon || "⏰",
          category: insight.category,
          metrics: insight.metrics || {},
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting platform insights:', error);
      throw error;
    }
  }

  /**
   * Get admin career dashboard data (metrics and insights)
   * Combines admin analytics, platform insights, and skill trends
   */
  async getAdminCareerDashboard(timeframe = '6m', authToken = null) {
    try {
      const axios = require('axios');
      const API_GATEWAY_URL = process.env.API_GATEWAY_URL || process.env.API_GATEWAY_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000';
      
      // Get platform insights and skill trends from our own service
      const platformInsights = await this.getPlatformInsights();
      const skillTrends = await this.getSkillTrends();
      
      // Get project stats from database
      const { ProjectsModel } = require('../models/projects.model');
      const projectStats = await ProjectsModel.getAdminProjectStats(timeframe);
      
      // Fetch admin analytics from user-service via API gateway
      let adminAnalytics = null;
      let metrics = [];
      
      try {
        if (authToken) {
          const adminAnalyticsResponse = await axios.get(
            `${API_GATEWAY_URL}/api/v1/user/admin/analytics?timeframe=${timeframe}`,
            {
              headers: {
                Authorization: authToken,
              },
              timeout: 10000,
              validateStatus: (status) => status < 500,
            }
          );
          
          if (adminAnalyticsResponse.status === 200 && adminAnalyticsResponse.data?.success) {
            adminAnalytics = adminAnalyticsResponse.data.data;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch admin analytics from user-service:', error.message);
      }
      
      // Build metrics from admin analytics and project stats
      if (adminAnalytics?.stats) {
        const stats = adminAnalytics.stats;
        const successRate = projectStats.totalProjects > 0
          ? Math.round((projectStats.completedProjects / projectStats.totalProjects) * 100)
          : 0;
        
        metrics = [
          {
            id: 1,
            title: "Platform Growth",
            value: stats.totalUsers?.toLocaleString() || "0",
            change: stats.monthlyGrowth >= 0 ? `+${stats.monthlyGrowth}%` : `${stats.monthlyGrowth}%`,
            trend: stats.monthlyGrowth >= 0 ? "up" : "down",
            icon: "📈",
            description: "Total active users this month",
            color: "from-green-500 to-emerald-500"
          },
          {
            id: 2,
            title: "Project Success Rate",
            value: `${successRate}%`,
            change: "+0%",
            trend: "up",
            icon: "🎯",
            description: "Projects completed successfully",
            color: "from-blue-500 to-indigo-500"
          },
          {
            id: 3,
            title: "Developer Satisfaction",
            value: `${stats.avgRating || 0}/5`,
            change: "+0",
            trend: "up",
            icon: "⭐",
            description: "Average developer rating",
            color: "from-yellow-500 to-orange-500"
          },
          {
            id: 4,
            title: "Revenue Growth",
            value: stats.revenue || "$0",
            change: stats.monthlyGrowth >= 0 ? `+${stats.monthlyGrowth}%` : `${stats.monthlyGrowth}%`,
            trend: stats.monthlyGrowth >= 0 ? "up" : "down",
            icon: "💰",
            description: "Monthly recurring revenue",
            color: "from-purple-500 to-pink-500"
          }
        ];
      } else {
        // Fallback: build metrics from project stats only
        const successRate = projectStats.totalProjects > 0
          ? Math.round((projectStats.completedProjects / projectStats.totalProjects) * 100)
          : 0;
        
        metrics = [
          {
            id: 1,
            title: "Platform Growth",
            value: "0",
            change: "+0%",
            trend: "up",
            icon: "📈",
            description: "Total active users this month",
            color: "from-green-500 to-emerald-500"
          },
          {
            id: 2,
            title: "Project Success Rate",
            value: `${successRate}%`,
            change: "+0%",
            trend: "up",
            icon: "🎯",
            description: "Projects completed successfully",
            color: "from-blue-500 to-indigo-500"
          },
          {
            id: 3,
            title: "Developer Satisfaction",
            value: "0/5",
            change: "+0",
            trend: "up",
            icon: "⭐",
            description: "Average developer rating",
            color: "from-yellow-500 to-orange-500"
          },
          {
            id: 4,
            title: "Revenue Growth",
            value: "$0",
            change: "+0%",
            trend: "up",
            icon: "💰",
            description: "Monthly recurring revenue",
            color: "from-purple-500 to-pink-500"
          }
        ];
      }
      
      // Build insights array from platform insights and skill trends
      const insights = [];
      
      // Add platform insights first
      if (platformInsights && platformInsights.length > 0) {
        insights.push(...platformInsights.slice(0, 3).map(insight => ({
          id: insight.id,
          title: insight.title || "Platform Insight",
          description: insight.description || "No description available",
          impact: insight.impact || "Medium",
          recommendation: insight.recommendation || "Review this insight",
          icon: insight.icon || "📊"
        })));
      }
      
      // Add skill trends as insights if we don't have enough platform insights
      if (insights.length < 3 && skillTrends && skillTrends.length > 0) {
        const remaining = 3 - insights.length;
        skillTrends.slice(0, remaining).forEach((trend, index) => {
          insights.push({
            id: `trend-${trend.id || index}`,
            title: `Skill Trend: ${trend.skill || 'Unknown'}`,
            description: `Demand for ${trend.skill || 'this skill'} is ${trend.growth || 'increasing'}`,
            impact: trend.impact || "Medium",
            recommendation: trend.recommendation || "Monitor this trend closely",
            icon: trend.icon || "📊"
          });
        });
      }
      
      return {
        metrics,
        insights
      };
    } catch (error) {
      console.error('Error getting admin career dashboard:', error);
      throw error;
    }
  }

  /**
   * Analyze team skills (for project owners)
   */
  async analyzeTeam(projectOwnerId, projectId = null, teamData = {}) {
    try {
      const existing = await TeamAnalysisModel.getAnalysisByProjectOwner(projectOwnerId, projectId, 10);
      if (existing && existing.length > 0) {
        return existing.map(analysis => ({
          id: analysis.id,
          skill: analysis.skill,
          current: analysis.currentCount,
          needed: analysis.neededCount,
          gap: analysis.gap,
          priority: analysis.priority,
          icon: analysis.icon || "💻",
          category: analysis.category,
          suggestions: analysis.suggestions || [],
        }));
      }
      return [];
    } catch (error) {
      console.error('Error analyzing team:', error);
      throw error;
    }
  }
}

module.exports = new AICareerService();
