// Import all models (each model exports both table and model class)
const { projectsTable, ProjectsModel } = require("./projects.model");
const { skillsTable, projectSkillsTable, ProjectSkillsModel } = require("./project-skills.model");
const { tagsTable, projectTagsTable, ProjectTagsModel } = require("./project-tags.model");
const { projectApplicantsTable, ProjectApplicantsModel } = require("./project-applicants.model");
const { projectInvitesTable, ProjectInvitesModel } = require("./project-invites.model");
const { projectTeamTable, ProjectTeamModel } = require("./project-team.model");
const { projectFilesTable, ProjectFilesModel } = require("./project-files.model");
const { projectUpdatesTable, ProjectUpdatesModel } = require("./project-updates.model");
const { projectReviewsTable, ProjectReviewsModel } = require("./project-reviews.model");
const { projectBoostsTable, ProjectBoostsModel } = require("./project-boosts.model");
const { projectCollaboratorsTable, ProjectCollaboratorsModel } = require("./project-collaborators.model");
const { projectAnalyticsTable, ProjectAnalyticsModel } = require("./project-analytics.model");
const { projectNotificationsTable, ProjectNotificationsModel } = require("./project-notifications.model");
const { projectCommentsTable, ProjectCommentsModel } = require("./project-comments.model");
const { projectMilestonesTable, ProjectMilestonesModel } = require("./project-milestones.model");
const { projectTasksTable, ProjectTasksModel } = require("./project-tasks.model");
const { taskSubmissionsTable, TaskSubmissionsModel } = require("./task-submissions.model");
const { taskCommentsTable, TaskCommentsModel } = require("./task-comments.model");
const { taskTimeTrackingTable, TaskTimeTrackingModel } = require("./task-time-tracking.model");
const { projectFavoritesTable, ProjectFavoritesModel } = require("./project-favorites.model");
const { projectSavesTable, ProjectSavesModel } = require("./project-saves.model");
const {
  careerRecommendationsTable,
  resumeSuggestionsTable,
  skillGapsTable,
  developerMatchesTable,
  projectOptimizationsTable,
  skillTrendsTable,
  platformInsightsTable,
  teamAnalysisTable,
  CareerRecommendationsModel,
  ResumeSuggestionsModel,
  SkillGapsModel,
  DeveloperMatchesModel,
  ProjectOptimizationsModel,
  SkillTrendsModel,
  PlatformInsightsModel,
  TeamAnalysisModel,
} = require("./ai-career.model");

// Legacy ProjectModel for backward compatibility
const ProjectModel = {
  // Projects CRUD
  createProject: ProjectsModel.createProject,
  getProjectById: ProjectsModel.getProjectById,
  getProjectByUUID: ProjectsModel.getProjectByUUID,
  listProjects: ProjectsModel.listProjects,
  updateProject: ProjectsModel.updateProject,
  softDeleteProject: ProjectsModel.softDeleteProject,
  
  // Skills & Tags
  setSkills: ProjectSkillsModel.setProjectSkills,
  setTags: ProjectTagsModel.setProjectTags,
  
  // Applicants
  applyToProject: ProjectApplicantsModel.applyToProject,
  withdrawApplication: ProjectApplicantsModel.withdrawApplication,
  updateApplicantStatus: ProjectApplicantsModel.updateApplicantStatus,
  listApplicants: ProjectApplicantsModel.listApplicants,
  listApplicationsByUser: ProjectApplicantsModel.listApplicationsByUser,
  countApplicationsByUser: ProjectApplicantsModel.countApplicationsByUser,
  getAppliedProjectIdsByUser: ProjectApplicantsModel.getAppliedProjectIdsByUser,
  
  // Invites
  createInvite: ProjectInvitesModel.createInvite,
  respondInvite: ProjectInvitesModel.respondInvite,
  deleteInvite: ProjectInvitesModel.deleteInvite,
  getInviteById: ProjectInvitesModel.getInviteById,
  getInvitesByProjectId: ProjectInvitesModel.getInvitesByProjectId,
  getInvitesByEmail: ProjectInvitesModel.getInvitesByEmail,
  getInvitesByProjectIdAndUserId: ProjectInvitesModel.getInvitesByProjectIdAndUserId,
  getInvitesByProjectOwner: ProjectInvitesModel.getInvitesByProjectOwner,
  
  // Files
  addFile: ProjectFilesModel.addFile,
  getFilesByProjectId: ProjectFilesModel.getFilesByProjectId,
  
  // Updates
  addUpdate: ProjectUpdatesModel.addUpdate,
  getProjectUpdates: ProjectUpdatesModel.getUpdatesByProjectId,
  
  // Reviews
  addReview: ProjectReviewsModel.addReview,
  getProjectReviews: ProjectReviewsModel.getReviewsByProjectId,
  
  // Boosts
  addBoost: ProjectBoostsModel.addBoost,
  getProjectBoosts: ProjectBoostsModel.getBoostsByProjectId,
  
  // New functionality
  addCollaborator: ProjectCollaboratorsModel.addCollaborator,
  addAnalytics: ProjectAnalyticsModel.addMetric,
  addNotification: ProjectNotificationsModel.addNotification,
  addComment: ProjectCommentsModel.addComment,
  getProjectComments: ProjectCommentsModel.getCommentsByProjectId,
  updateProjectComment: ProjectCommentsModel.updateComment,
  deleteProjectComment: ProjectCommentsModel.deleteComment,
  addMilestone: ProjectMilestonesModel.addMilestone,
  addTask: ProjectTasksModel.addTask,
  
  // Favorites
  addProjectFavorite: ProjectsModel.addProjectFavorite,
  removeProjectFavorite: ProjectsModel.removeProjectFavorite,
  getProjectFavorites: ProjectsModel.getProjectFavorites,
  addProjectSave: ProjectsModel.addProjectSave,
  removeProjectSave: ProjectsModel.removeProjectSave,
  getProjectSaves: ProjectsModel.getProjectSaves,
  
  // Search
  searchProjects: ProjectsModel.searchProjects,
  
  // Recommendations
  getProjectRecommendations: ProjectsModel.getProjectRecommendations,
  
  // Statistics
  getProjectStats: ProjectsModel.getProjectStats,
  
  // Project Owner Profile Methods
  getProjectsByOwner: ProjectsModel.getProjectsByOwner,
  getProjectApplicants: ProjectApplicantsModel.listApplicants,
  getProjectReviews: ProjectReviewsModel.getReviewsByProjectId,
  getApplicantsByStatus: ProjectApplicantsModel.getApplicantsByStatus,
  getApplicantByProjectAndUser: ProjectApplicantsModel.getApplicantByProjectAndUser,
};

module.exports = {
  // Tables (for database operations)
  projectsTable,
  skillsTable,
  tagsTable,
  projectSkillsTable,
  projectTagsTable,
  projectApplicantsTable,
  projectInvitesTable,
  projectTeamTable,
  projectFilesTable,
  projectUpdatesTable,
  projectReviewsTable,
  projectBoostsTable,
  projectCollaboratorsTable,
  projectAnalyticsTable,
  projectNotificationsTable,
  projectCommentsTable,
  projectMilestonesTable,
  projectTasksTable,
  taskSubmissionsTable,
  taskCommentsTable,
  taskTimeTrackingTable,
  projectFavoritesTable,
  projectSavesTable,
  careerRecommendationsTable,
  resumeSuggestionsTable,
  skillGapsTable,
  developerMatchesTable,
  projectOptimizationsTable,
  skillTrendsTable,
  platformInsightsTable,
  teamAnalysisTable,
  
  // Model Classes (for business logic)
  ProjectsModel,
  ProjectSkillsModel,
  ProjectTagsModel,
  ProjectApplicantsModel,
  ProjectInvitesModel,
  ProjectTeamModel,
  ProjectFilesModel,
  ProjectUpdatesModel,
  ProjectReviewsModel,
  ProjectBoostsModel,
  ProjectCollaboratorsModel,
  ProjectAnalyticsModel,
  ProjectNotificationsModel,
  ProjectCommentsModel,
  ProjectMilestonesModel,
  ProjectTasksModel,
  TaskSubmissionsModel,
  TaskCommentsModel,
  TaskTimeTrackingModel,
  ProjectFavoritesModel,
  ProjectSavesModel,
  CareerRecommendationsModel,
  ResumeSuggestionsModel,
  SkillGapsModel,
  DeveloperMatchesModel,
  ProjectOptimizationsModel,
  SkillTrendsModel,
  PlatformInsightsModel,
  TeamAnalysisModel,
  
  // Legacy Model (for backward compatibility with existing controllers)
  ProjectModel,
};
