public inherited sharing class AgentMonthlyTierData {

    public static list<Agent_Monthly_Tier__c> getPreviousMonthAgentMonthlyTierRecords(String month, String year) {
        return [SELECT Id, Calculation_Status__c ,Active__c,Is_Active_Prev_Month__c
                    FROM Agent_Monthly_Tier__c 
                    WHERE Active__c = True AND month__c = :month AND year__c =: year
                    AND Calculation_Status__c = :AgentMonthlyTierUtil.CALCULATION_STATUS_DRAFT
                ];
    }

    public static Map<Id,Agent_Monthly_Tier__c> getCloserToActiveAMT(Set<Id> activeClosers){
       Map<Id,Agent_Monthly_Tier__c> closerToActiveAMTMap = New Map<Id,Agent_Monthly_Tier__c>();
       for(Agent_Monthly_Tier__c amt :   [
                SELECT Id, Closer__c, Tier__c, Commission_Rate__c 
                FROM Agent_Monthly_Tier__c 
                WHERE Active__c = true AND Closer__c IN :activeClosers
                ]){
                    closerToActiveAMTMap.put(amt.Closer__c, amt);
                }
         return closerToActiveAMTMap;       
    }

    public static List<Agent_Monthly_Tier__c> getActiveAMTierRecords(set<Id> activeClosers){
        return [
                SELECT Id, Closer__c, Tier__c, Commission_Rate__c 
                FROM Agent_Monthly_Tier__c 
                WHERE Active__c = true AND Closer__c IN :activeClosers
                ];
    }

    public static Map<Id,Agent_Monthly_Tier__c> getPreviousMonthAMTByCloser(Set<Id> activeClosers){
        Map<Id,Agent_Monthly_Tier__c> closersToPreviousMonthTeirMap = New Map<Id,Agent_Monthly_Tier__c>();
        for(Agent_Monthly_Tier__c agentMont :  [
                SELECT Id, Closer__c, Tier__c, Commission_Rate__c 
                FROM Agent_Monthly_Tier__c 
                WHERE Is_Active_Prev_Month__c = true AND Closer__c IN :activeClosers
        ]){
            closersToPreviousMonthTeirMap.put(agentMont.Closer__c, agentMont);
        }

        return closersToPreviousMonthTeirMap;
    }

    public static List<Agent_Monthly_Tier__c> getPreviousMonthAcitveAMT(String month){
        return [
            SELECT ID FROM Agent_Monthly_Tier__c 
            WHERE Month__c = :month AND Is_Active_Prev_Month__c = true
        ];
    }
}