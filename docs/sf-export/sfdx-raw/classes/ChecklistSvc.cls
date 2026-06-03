public inherited sharing class ChecklistSvc {

    public static void createChecklists(List<ChecklistCreationWrapper> checklistCreationWrapperList) {
        Set<String> configKeys = new Set<String>();
        Set<String> categoryNames = new Set<String>();
        Set<String> checklistNames = new Set<String>();
        Set<Id> sobjIds = new Set<Id>();
        for (ChecklistCreationWrapper checklistCreationWrap : checklistCreationWrapperList) {
            categoryNames.add(checklistCreationWrap.categoryName);
            checklistNames.add(checklistCreationWrap.checklistName);
            sobjIds.add(checklistCreationWrap.sObjId);
        }
        Map<String, Map<String, List<ChecklistConfig__mdt>>> checkListItemConfigMap = getChecklistItems(categoryNames, checklistNames);
        Map<Id, Map<String, AccountTeamMember>> accountTeamMap = queryAccountTeamMebers(sobjIds);
        System.debug('checklistCreationWrapperList---->'+checklistCreationWrapperList);
        createChecklistItems(checklistCreationWrapperList, checkListItemConfigMap, accountTeamMap);
    }

    /*private static String constructKey(String categoryName, String checklistName) {
        return categoryName.deleteWhitespace() + '_' + checklistName.deleteWhitespace();
    }*/

    public static Map<String, Map<String, List<ChecklistConfig__mdt>>> getChecklistItems(Set<String> categoryNames, Set<String> checklistNames) {
        Map<String, Map<String, List<ChecklistConfig__mdt>>> checklistConfigMap = new Map<String, Map<String, List<ChecklistConfig__mdt>>>();
        for (ChecklistConfig__mdt checklistConfig : [SELECT Id, DeveloperName, Category__c, Checklist_Name__c, Checklist_Item_Name__c, 
            Owner_Assignment_Type__c, Account_Team_Member_Role__c, Due_Date_Period__c FROM ChecklistConfig__mdt WHERE Category__c IN :categoryNames AND Checklist_Name__c IN :checklistNames]
        ) {
            if (!checklistConfigMap.containsKey(checklistConfig.Category__c)) {
                checklistConfigMap.put(checklistConfig.Category__c, new Map<String, List<ChecklistConfig__mdt>>());
            }
            if (!checklistConfigMap.get(checklistConfig.Category__c).containsKey(checklistConfig.Checklist_Name__c)) {
                checklistConfigMap.get(checklistConfig.Category__c).put(checklistConfig.Checklist_Name__c, new List<ChecklistConfig__mdt>());
            }
            checklistConfigMap.get(checklistConfig.Category__c).get(checklistConfig.Checklist_Name__c).add(checklistConfig);
        }
        System.debug('checklistConfigMap--->'+checklistConfigMap);
        return checklistConfigMap;
    }

    private static Map<Id, Map<String, AccountTeamMember>> queryAccountTeamMebers(Set<Id> sobjIds) {
        Map<Id, Map<String, AccountTeamMember>> accountTeamMemberMap = new Map<Id, Map<String, AccountTeamMember>>();
        for (AccountTeamMember teamMember : [SELECT Id, UserId, AccountId, TeamMemberRole FROM AccountTeamMember WHERE AccountId IN :sobjIds ORDER BY Primary_Team_Member__c DESC]) {
            if (!accountTeamMemberMap.containsKey(teamMember.AccountId)) {
                accountTeamMemberMap.put(teamMember.AccountId, new Map<String, AccountTeamMember>());
            }
            if (!accountTeamMemberMap.get(teamMember.AccountId).containsKey(teamMember.TeamMemberRole)) {
                accountTeamMemberMap.get(teamMember.AccountId).put(teamMember.TeamMemberRole, teamMember);
            }
        }
        return accountTeamMemberMap;
    }

    private static void createChecklistItems(
        List<ChecklistCreationWrapper> checklistCreationWrapperList, 
        Map<String, Map<String, List<ChecklistConfig__mdt>>> checkListItemConfigMap,
        Map<Id, Map<String, AccountTeamMember>> accountTeamMap
    ) {
        Map<String, List<Task>> checklistItemsToDMLMap = new Map<String, List<Task>>();
        Map<String, Checklist__c> checklistsToDMLMap = new Map<String, Checklist__c>();
        Id checklistRecordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
        for (ChecklistCreationWrapper checklistCreationWrap : checklistCreationWrapperList) {
            String categoryName = checklistCreationWrap.categoryName;
            String checklistName = checklistCreationWrap.checklistName;
            String key = categoryName.deleteWhitespace() + '_' + checklistName.deleteWhitespace();
            if (checkListItemConfigMap.containsKey(categoryName)) {
                Map<String, List<ChecklistConfig__mdt>> checklistNameItemsMap = checkListItemConfigMap.get(categoryName);
                if (checklistNameItemsMap.containsKey(checklistName)) {
                    for (ChecklistConfig__mdt checklistConfigRecord : checklistNameItemsMap.get(checklistName)) {
                        Task checklistItemToDML = new Task();
                        checklistItemToDML.recordTypeId = checklistRecordTypeId;
                        checklistItemToDML.Subject = checklistConfigRecord.Checklist_Item_Name__c;
                        if (ApexUtil.isWhoId(checklistCreationWrap.sObjId)) {
                            checklistItemToDML.WhoId = checklistCreationWrap.sObjId;
                        } else {
                            checklistItemToDML.WhatId = checklistCreationWrap.sObjId;
                        }
                        checklistItemToDML.Status = 'Not Started';
                        if (checklistConfigRecord.Due_Date_Period__c != null && checklistConfigRecord.Due_Date_Period__c > 0) {
                            checklistItemToDML.ActivityDate = System.today().addDays(Integer.valueOf(checklistConfigRecord.Due_Date_Period__c));
                        } else {
                            checklistItemToDML.ActivityDate = System.today();
                        }
                        if (checklistConfigRecord.Owner_Assignment_Type__c == 'Account Team Member Role' && accountTeamMap.containsKey(checklistCreationWrap.sObjId)) {
                            Map<String, AccountTeamMember> teamMembersMap = accountTeamMap.get(checklistCreationWrap.sObjId);
                            if (teamMembersMap.containsKey(checklistConfigRecord.Account_Team_Member_Role__c)) {
                                checklistItemToDML.OwnerId = teamMembersMap.get(checklistConfigRecord.Account_Team_Member_Role__c).UserId;
                            }
                        }
                        if (!checklistItemsToDMLMap.containsKey(key)) {
                            checklistItemsToDMLMap.put(key, new List<Task>());
                        }
                        checklistItemsToDMLMap.get(key).add(checklistItemToDML);
                    }
                }
            }
            if (!checklistsToDMLMap.containsKey(key)) {
                Checklist__c checklistToDML = new Checklist__c();
                checklistToDML.Name = checklistCreationWrap.checklistName;
                checklistToDML.Account__c = checklistCreationWrap.sObjId;
                checklistToDML.Active__c = true;
                checklistsToDMLMap.put(key, checklistToDML);
            }
        }
        if (!checklistsToDMLMap.isEmpty()) {
            insert checklistsToDMLMap.values();
            
            List<Task> checklistItemsToDML = new List<Task>();
            for (String key : checklistItemsToDMLMap.keySet()) {
                for (Task checklistItem : checklistItemsToDMLMap.get(key)) {
                    checklistItem.Checklist__c = checklistsToDMLMap.get(key).Id;
                    checklistItemsToDML.add(checklistItem);
                }
            }
            insert checklistItemsToDML;
        }
    }

    public class ChecklistCreationWrapper {
        public String checklistName;
        public String categoryName;
        public Id sObjId;
    }
}