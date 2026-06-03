public without sharing class AccountTeamMemberHandler extends TriggerHandler {

    public override void afterUpdate() {
        reassignChecklistItems();
    }

    private static void reassignChecklistItems() {
        Map<Id, Map<String, AccountTeamMember>> acctTeamMemberMap = new Map<Id, Map<String, AccountTeamMember>>();
        Set<String> roleSet = new Set<String>();
        for (AccountTeamMember acctTeamMember : (List<AccountTeamMember>)Trigger.new) {
            AccountTeamMember oldAcctTeamMember = (AccountTeamMember)Trigger.oldMap.get(acctTeamMember.Id);
            if (acctTeamMember.Primary_Team_Member__c != oldAcctTeamMember.Primary_Team_Member__c && acctTeamMember.Primary_Team_Member__c == true) {
                roleSet.add(acctTeamMember.TeamMemberRole);
                if (!acctTeamMemberMap.containsKey(acctTeamMember.AccountId)) {
                    acctTeamMemberMap.put(acctTeamMember.AccountId, new Map<String, AccountTeamMember>());
                }
                acctTeamMemberMap.get(acctTeamMember.AccountId).put(acctTeamMember.TeamMemberRole, acctTeamMember);
            }
        }

        if (!acctTeamMemberMap.isEmpty()) {
            Map<Id, List<Task>> accountIdTasksMap = new Map<Id, List<Task>>();
            for (Task checklistItem : [SELECT Id, WhatId, Owner.UserRole.Name FROM Task WHERE WhatId IN :acctTeamMemberMap.keySet() AND Owner.UserRole.Name IN :roleSet AND Status != 'Completed']) {
                if (!accountIdTasksMap.containsKey(checklistItem.WhatId)) {
                    accountIdTasksMap.put(checklistItem.WhatId, new List<Task>());
                }
                accountIdTasksMap.get(checklistItem.WhatId).add(checklistItem);
            }
            List<Task> tasksToUpdate = new List<Task>();
            for (Id acctId : accountIdTasksMap.keySet()) {
                for (Task checklistItem : accountIdTasksMap.get(acctId)) {
                    String userRole = checklistItem.Owner.UserRole.Name;
                    if (acctTeamMemberMap.containsKey(acctId)) {
                        Map<String, AccountTeamMember> teamMemberMap = acctTeamMemberMap.get(acctId);
                        if (teamMemberMap.containsKey(userRole)) {
                            Task taskToUpdate = new Task();
                            taskToUpdate.Id = checklistItem.Id;
                            taskToUpdate.OwnerId = teamMemberMap.get(userRole).UserId;
                            tasksToUpdate.add(taskToUpdate);
                        }
                    }
                }
            }
            System.debug('tasksToUpdate--->'+tasksToUpdate);
            update tasksToUpdate;
        }
    }

}