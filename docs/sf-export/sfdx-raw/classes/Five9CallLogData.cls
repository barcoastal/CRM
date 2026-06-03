public inherited sharing class Five9CallLogData { 

    public static Map<Id, AggregateResult> getFive9RecordCountRelatedLead(Set<Id> leadIds) {
        return new Map<Id, AggregateResult>([
            SELECT COUNT(Id), Lead__c Id
            FROM Five9_Call_Log__c WHERE Lead__c IN :leadIds GROUP BY Lead__c
        ]);
    }
    
    public static List<Five9_Connector_Disposition__mdt> getFive9LeadQualifiedDispositions() {
        return [SELECT Id, Label,Is_Lead_Marketing_Qualified__c 
                FROM Five9_Connector_Disposition__mdt 
                WHERE Is_Lead_Marketing_Qualified__c = True];
    }
}