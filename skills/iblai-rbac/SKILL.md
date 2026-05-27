---
name: iblai-rbac
description: List of default RBAC roles and how to find all action definitions
globs:
alwaysApply: false
---

# Rbac Roles
A list of all actions can be found [here](https://base.manager.iblai.app/api/core/rbac/actions/definitions/) (requires a DM token in the Authorization header: `Authorization: Token <token>`)

## Default Roles
```python
# Requirements to chat 
STUDENT = {
    "actions": [
        "Ibl.Mentor/Settings/read",
        "Ibl.Mentor/Chat/action",
        "Ibl.Mentor/Mentors/read",
        "Ibl.Mentor/Prompts/list",
        "Ibl.Mentor/Prompts/read",
        "Ibl.Mentor/Tools/list",
        "Ibl.Mentor/Tools/read",
        "Ibl.Mentor/Disclaimers/list",
        "Ibl.Mentor/Disclaimers/read",
        "Ibl.Mentor/Artifacts/*",
        "Ibl.Mentor/ConnectedServices/list",
        "Ibl.Mentor/ConnectedServices/action",
        "Ibl.Mentor/GetRedirectUrl/action",
        "Ibl.Mentor/MCPServers/list",
        "Ibl.Mentor/MCPServers/read",
        "Ibl.Mentor/MCPServerConnections/list",
        "Ibl.Mentor/MCPServerConnections/action",
        "Ibl.Mentor/MemoryCategory/list",
    ],
    "data_actions": [
        "Ibl.Mentor/Settings/id/read",
        "Ibl.Mentor/Settings/display_name/read",
        "Ibl.Mentor/Settings/profile_image/read",
        "Ibl.Mentor/Settings/embed_custom_image/read",
        "Ibl.Mentor/Settings/initial_message/read",
        "Ibl.Mentor/Settings/suggested_message/read",
        "Ibl.Mentor/Settings/theme/read",
        "Ibl.Mentor/Settings/user_message_color/read",
        "Ibl.Mentor/Settings/mentor_bubble_color/read",
        "Ibl.Mentor/Settings/align_mentor_bubble/read",
        "Ibl.Mentor/Settings/mentor/read",
        "Ibl.Mentor/Settings/mentor_slug/read",
        "Ibl.Mentor/Settings/mentor_unique_id/read",
        "Ibl.Mentor/Settings/metadata/read",
        "Ibl.Mentor/Settings/mentor_visibility/read",
        "Ibl.Mentor/Settings/enable_image_generation/read",
        "Ibl.Mentor/Settings/enable_web_browsing/read",
        "Ibl.Mentor/Settings/enable_code_interpreter/read",
        "Ibl.Mentor/Settings/custom_css/read",
        "Ibl.Mentor/Settings/allow_anonymous/read",
        "Ibl.Mentor/Settings/mentor_description/read",
        "Ibl.Mentor/Settings/suggested_prompts/read",
        "Ibl.Mentor/Settings/proactive_response/read",
        "Ibl.Mentor/Settings/greeting_method/read",
        "Ibl.Mentor/Settings/mentor_tools/read",
        "Ibl.Mentor/Settings/can_use_tools/read",
        "Ibl.Mentor/Settings/llm_name/read",
        "Ibl.Mentor/Settings/proactive_prompt/read",
        "Ibl.Mentor/Settings/disclaimer/read",
        "Ibl.Mentor/Settings/enable_memory_component/read",
        "Ibl.Mentor/Settings/enable_email_chat/read",
        "Ibl.Mentor/Settings/enable_spaced_repetition/read",
        "Ibl.Mentor/Settings/enable_instruction_mode/read",
        "Ibl.Mentor/Settings/enable_socratic_mode/read",
        "Ibl.Mentor/Settings/is_guided_mentor/read",
        "Ibl.Mentor/Settings/enable_guided_prompts/read",
        "Ibl.Mentor/Settings/enable_moderation/read",
        "Ibl.Mentor/Settings/enable_post_processing_system/read",
        "Ibl.Mentor/Settings/enable_safety_system/read",
        "Ibl.Mentor/Settings/forkable/read",
        "Ibl.Mentor/Settings/forkable_with_training_data/read",
        "Ibl.Mentor/Settings/mentor_name/read",
        "Ibl.Mentor/Settings/categories/read",
        "Ibl.Mentor/Settings/recently_accessed_at/read",
        "Ibl.Mentor/Settings/created_by/read",
        "Ibl.Mentor/Settings/created_at/read",
        "Ibl.Mentor/Settings/updated_at/read",
        "Ibl.Mentor/Settings/platform_key/read",
        "Ibl.Mentor/Settings/show_attachment/read",
        "Ibl.Mentor/Settings/show_voice_call/read",
        "Ibl.Mentor/Settings/show_voice_record/read",
        "Ibl.Mentor/Settings/starter_prompts/read",
        "Ibl.Mentor/Settings/embed_is_context_aware/read",
        "Ibl.Mentor/Settings/embed_open_by_default/read",
        "Ibl.Mentor/Settings/embed_show_attachment/read",
        "Ibl.Mentor/Settings/embed_show_voice_call/read",
        "Ibl.Mentor/Settings/embed_show_voice_record/read",
        "Ibl.Mentor/Mentors/id/read",
        "Ibl.Mentor/Mentors/name/read",
        "Ibl.Mentor/Mentors/unique_id/read",
        "Ibl.Mentor/Mentors/allow_anonymous/read",
        "Ibl.Mentor/Mentors/can_use_tools/read",
        "Ibl.Mentor/Mentors/tools/read",
        "Ibl.Mentor/Mentors/disable_chathistory/read",
        "Ibl.Mentor/Mentors/profile_image/read",
        "Ibl.Mentor/Mentors/embed_custom_image/read",
        "Ibl.Mentor/Mentors/description/read",
        "Ibl.Mentor/Mentors/platform_key/read",
        "Ibl.Mentor/Mentors/metadata/read",
        "Ibl.Mentor/Mentors/llm_name/read",
        "Ibl.Mentor/Mentors/llm_provider/read",
        "Ibl.Mentor/Mentors/created_at/read",
        "Ibl.Mentor/Mentors/created_by/read",
        "Ibl.Mentor/Mentors/updated_at/read",
        "Ibl.Mentor/Mentors/recently_accessed_at/read",
        "Ibl.Mentor/Mentors/last_accessed_by/read",
        "Ibl.Mentor/Mentors/mentor_visibility/read",
        "Ibl.Mentor/Mentors/categories/read",
        "Ibl.Mentor/Mentors/slug/read",
        "Ibl.Mentor/Mentors/starred/read",
        "Ibl.Mentor/Mentors/uploaded_profile_image/read",
        "Ibl.Mentor/Prompts/*/read",
        "Ibl.Mentor/Tools/*/read",
        "Ibl.Mentor/Artifacts/*",
        "Ibl.Mentor/MCPServers/*/read",
    ],
}

# Tenant admins have the highest level of permissions and can do everything within their tenant
TENANT_ADMIN = {
  "actions": ["Ibl.*"], 
  "data_actions": ["Ibl.*"]
}

# Allows user to view the analytics dashboards in skills and access analytics for UserGroups (Teams)
# they have access to.
# Requires Ibl.Analytics/Core/read or Ibl.Analaytics/Reports/read on /platforms/pk/usergroups/pk/ or /platforms/pk/users/pk/
ANALYTICS_VIEWER = {
    "actions": ["Ibl.Analytics/CanViewAnalytics/action"],
    "data_actions": [],
}

# Allows user to send notifications and manage notification templates.
# Only allows user to send notifications to Users/Teams they have access to.
# Requires Ibl.Notifications/Notification/action on /platforms/pk/users/pk/ or /platforms/pk/usergroups/pk/
NOTIFICATION_MANAGER = {
    "actions": [
        "Ibl.Notifications/CanSendNotifications/action",
        "Ibl.Notifications/NotificationTemplate/*",
    ],
    "data_actions": [],
}

# ALlows user to manage inviting users to various aspects of the platform
ENROLLMENT_MANAGER = {
    "actions": [
        "Ibl.Catalog/CourseEnrollments/*",
        "Ibl.Catalog/PathwayEnrollments/*",
        "Ibl.Catalog/ProgramEnrollments/*",
        "Ibl.Catalog/PlatformInvitations/*",
        "Ibl.Catalog/CourseInvitations/*",
        "Ibl.Catalog/PathwayInvitations/*",
        "Ibl.Catalog/ProgramInvitations/*",
        "Ibl.Catalog/CanInvite/action",
    ],
    "data_actions": [],
}

# Allows user to create mentors
MENTOR_CREATORS = {
    "actions": [
        "Ibl.Mentor/Mentors/action",
    ],
    "data_actions": [],
}

# Allows all students to list mentors. What is returned depends on which mentors they have access to.
# Requires Ibl.Mentor/Mentors/read on /platforms/pk/mentors/pk/
STUDENT_MENTOR_VIEWERS = {
    "actions": [
        "Ibl.Mentor/Mentors/list",
    ],
    "data_actions": [], 
}

# Allows users to list LLMs they have access to
LLM_USERS = {
    "actions": [
        "Ibl.Mentor/LLMs/list",
    ], 
    "data_actions": [],
}

# Grants user access to an LLM provider or model
LLM_MODEL_ACCESS = {
    "actions": [
        "Ibl.Mentor/LLMs/read",
    ],  
    "data_actions": [],
}

# Grants user read access to a mentor. Applied to /platforms/pk/mentors/pk/
MENTOR_VIEWER = {
    "actions": [
        "Ibl.Mentor/Settings/read",
        "Ibl.Mentor/Chat/action",
        "Ibl.Mentor/Mentors/read",
        "Ibl.Mentor/Prompts/read",
        "Ibl.Mentor/Prompts/list",
        "Ibl.Mentor/Documents/read",
        "Ibl.Mentor/Documents/list",
        "Ibl.Mentor/ShowSettings/action",
        "Ibl.Analytics/Reports/read",
        "Ibl.Mentor/Artifacts/list",
        "Ibl.Mentor/Artifacts/read",
        "Ibl.Mentor/Tools/list",
        "Ibl.Mentor/LLMs/list",
        "Ibl.Mentor/MCPServers/list",
        "Ibl.Mentor/ShareMentor/read",
        "Ibl.Mentor/ModerationLogs/list",
        "Ibl.Mentor/SafetyLogs/list",
        "Ibl.Mentor/Disclaimers/list",
        "Ibl.Mentor/Disclaimers/read",
        "Ibl.Mentor/ChatHistory/list",
        "Ibl.Mentor/ViewPromptsMenu/action",
        "Ibl.Mentor/ViewToolsMenu/action",
        "Ibl.Mentor/ViewDisclaimersMenu/action",
        "Ibl.Mentor/CanEmbed/action",
        "Ibl.Mentor/GraderConfigurations/read",
        "Ibl.Mentor/GraderCriteria/read",
        "Ibl.Mentor/GraderCriteria/list",
    ],
    "data_actions": [
        "Ibl.Mentor/Mentors/*/read",  
        "Ibl.Mentor/Settings/*/read",
        "Ibl.Mentor/Prompts/*/read", 
        "Ibl.Mentor/Documents/*/read", 
        "Ibl.Mentor/Artifacts/*/read",
    ],
}

# Grants user editor access to a mentor. Applied to /platforms/pk/mentors/pk/
MENTOR_EDITOR = {
    "actions": [
        "Ibl.Mentor/Mentors/write",
        "Ibl.Mentor/Settings/write",
        "Ibl.Mentor/Settings/read",
        "Ibl.Mentor/Mentors/read",
        "Ibl.Mentor/Prompts/read",
        "Ibl.Mentor/Prompts/delete",
        "Ibl.Mentor/Prompts/list",
        "Ibl.Mentor/Prompts/write",
        "Ibl.Mentor/Prompts/action",
        "Ibl.Mentor/Documents/read",
        "Ibl.Mentor/Documents/list",
        "Ibl.Mentor/Documents/write",
        "Ibl.Mentor/Documents/action",
        "Ibl.Mentor/Documents/delete",
        "Ibl.Mentor/Tools/list",
        "Ibl.Mentor/LLMs/list",
        "Ibl.Mentor/MCPServers/list",
        "Ibl.Mentor/ShareMentor/action",
        "Ibl.Mentor/ShareMentor/read",
        "Ibl.Mentor/ShowSettings/action",
        "Ibl.Mentor/Chat/action",
        "Ibl.Analytics/Reports/read",
        "Ibl.Mentor/Artifacts/list",
        "Ibl.Mentor/Artifacts/read",
        "Ibl.Mentor/Artifacts/write",
        "Ibl.Mentor/Artifacts/action",
        "Ibl.Mentor/Artifacts/delete",
        "Ibl.Mentor/ModerationLogs/list",
        "Ibl.Mentor/SafetyLogs/list",
        "Ibl.Mentor/Disclaimers/list",
        "Ibl.Mentor/Disclaimers/action",
        "Ibl.Mentor/Disclaimers/read",
        "Ibl.Mentor/Disclaimers/write",
        "Ibl.Mentor/ChatHistory/list",
        "Ibl.Mentor/CanEmbed/action",
        "Ibl.Mentor/ViewPromptsMenu/action",
        "Ibl.Mentor/ViewToolsMenu/action",
        "Ibl.Mentor/ViewDisclaimersMenu/action",
        "Ibl.Mentor/GraderConfigurations/action",
        "Ibl.Mentor/GraderConfigurations/read",
        "Ibl.Mentor/GraderConfigurations/write",
        "Ibl.Mentor/GraderCriteria/action",
        "Ibl.Mentor/GraderCriteria/read",
        "Ibl.Mentor/GraderCriteria/list",
        "Ibl.Mentor/GraderCriteria/write",
        "Ibl.Mentor/GraderCriteria/delete",
    ],
    "data_actions": [
        "Ibl.Mentor/Settings/*",
        "Ibl.Mentor/Mentors/*",
        "Ibl.Mentor/Prompts/*",
        "Ibl.Mentor/Documents/*",
        "Ibl.Mentor/Artifacts/*",
    ],
}

# Allows user to read an RBAC Group
GROUP_MENTOR_MANAGER = {
    "actions": ["Ibl.Core/Groups/list", "Ibl.Core/Groups/read"],
    "data_actions": ["Ibl.Core/Groups/*/read"], 
}

# Allows user to view analytics for a mentor
MENTOR_ANALYTICS_VIEWER = {
    "actions": [
        "Ibl.Analytics/CanViewMentorAnalytics/action",
        "Ibl.Analytics/Mentors/read",
        "Ibl.Analytics/Reports/read",
    ]
    + STDDENT["actions"],
    "data_actions": STDDENT["data_actions"],
}

# Allows users to list users at various points throughout the application
LIST_USERS = {
    "actions": ["Ibl.Core/Users/list"],
    "data_actions": [],
}

# Allows user to list UserGroups (Teams) at various point throughout the application
LIST_TEAMS = {
    "actions": ["Ibl.Core/UserGroups/list"],
    "data_actions": [],
}

# Allows user to create UserGroups (Teams)
CREATE_TEAMS = {
    "actions": ["Ibl.Core/UserGroups/action"],
    "data_actions": [],
}

# Allows user to read UserGroups (Teams) they have access to. Applied to /platforms/pk/usergroups/pk/
READ_TEAM = {
    "actions": ["Ibl.Core/UserGroups/read"],
    "data_actions": ["Ibl.Core/UserGroups/*/read"],
}

# Allows user to edit UserGroups (Teams) they have access to. Applied to /platforms/pk/usergroups/pk/
EDIT_TEAM = {
    "actions": [
        "Ibl.Core/UserGroups/read",
        "Ibl.Core/UserGroups/write",
    ],
    "data_actions": ["Ibl.Core/UserGroups/*"],
}

# Allows user to view analytics for a User or UserGroup (Team) they have access to. 
# Applied to /platforms/pk/usergroups/pk/ or /platforms/pk/users/pk/
READ_ANALYTICS = {
    "actions": [
        "Ibl.Analytics/Core/read",
        "Ibl.Analytics/Reports/read",
    ],
    "data_actions": [],
}

# Allows user to send notifications to Users or UserGroups (Teams) they have access to.
# Applied to /platforms/pk/usergroups/pk/ or /platforms/pk/users/pk/
SEND_NOTIFICATIONS = {
    "actions": [
        "Ibl.Notifications/Notification/action",
    ],
    "data_actions": [],
}

# Allows user to sell access to a mentor. Applied to a mentor at /platforms/pk/mentors/pk/
SELL_MENTOR = {
    "actions": [
        "Ibl.Mentor/CanSellMentor/action",
    ],
    "data_actions": [],
}

# Allows user to sell items on the platform. Gates access to selling any items on the platform.
SELL_ITEMS = {
    "actions": [
        "Ibl.Billing/CanSellItems/action",
    ],
    "data_actions": [],
}

# Allows user to manage platform credit settings
BILLING_MANAGER = {
    "actions": [
        "Ibl.Billing/Credits/read",
        "Ibl.Billing/Credits/write",
    ],
    "data_actions": [],
}

# Allows user to view CRM data
CRM_VIEWER = {
    "actions": [
        "Ibl.CRM/Persons/read",
        "Ibl.CRM/Persons/list",
        "Ibl.CRM/Organizations/read",
        "Ibl.CRM/Organizations/list",
        "Ibl.CRM/Pipelines/read",
        "Ibl.CRM/Pipelines/list",
        "Ibl.CRM/Deals/read",
        "Ibl.CRM/Deals/list",
        "Ibl.CRM/Activities/read",
        "Ibl.CRM/Activities/list",
        "Ibl.CRM/Tags/read",
        "Ibl.CRM/Tags/list",
    ],
    "data_actions": [],
}

# Allows a user to User the CRM system
CRM_USER = {
    "actions": [
        "Ibl.CRM/Persons/*",
        "Ibl.CRM/Organizations/*",
        "Ibl.CRM/Deals/*",
        "Ibl.CRM/Activities/*",
        "Ibl.CRM/Tags/*",
        "Ibl.CRM/Pipelines/read",
        "Ibl.CRM/Pipelines/list",
    ],
    "data_actions": [],
}

# Allows users to administer the CRM system
CRM_MANAGER = {
    "actions": [
        "Ibl.CRM/*",
    ],
    "data_actions": [],
}

# Allows user to invite leads in the CRM to the platform
CRM_INVITER = {
    "actions": [
        "Ibl.CRM/Persons/read",
        "Ibl.CRM/Persons/list",
        "Ibl.CRM/Invite/action",
    ],
    "data_actions": [],
}

# Allows user to read a Watched Group
WATCHED_GROUP_READ = {
    "actions": [
        "Ibl.Core/WatchedGroups/read",
        "Ibl.Core/Watchers/list",
        "Ibl.Core/WatchedUsers/list",
        "Ibl.Core/WatchedUsers/read",
    ],
    "data_actions": [
        "Ibl.Core/WatchedGroups/*/read",
        "Ibl.Core/WatchedUsers/*/read",
    ],
}

# Additional grants granted on watchers on a WatchedGroup.
WATCHED_GROUP_WATCHER_GRANTS = {
    "actions": [
        "Ibl.Analytics/Core/read",
        "Ibl.Analytics/Reports/read",
    ],
    "data_actions": [],
}

# Allows user to list watched groups, returning what they have access to.
# Requires Ibl.Core/WatchedGroups/read on /platforms/pk/watchedgroups/pk/
WATCHED_GROUP_LIST = {
    "actions": ["Ibl.Core/WatchedGroups/list"],
    "data_actions": [],
}

```
