public inherited sharing class InboundAPILogData { 
    public static Inbound_API_Log__c queryInboundLogData(String inboundId) {
        return [
            SELECT Id, Name FROM Inbound_API_Log__c WHERE Id =:inboundId
        ];
    }
}