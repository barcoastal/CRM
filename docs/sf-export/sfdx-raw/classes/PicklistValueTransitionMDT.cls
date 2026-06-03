/**
 * @Description: Class to process the values in PicklistValueTransition custom metadata.
 */
public inherited sharing class PicklistValueTransitionMDT{    
        
    /**
     * @description: Method to get all the picklist transition records
    */
    public static Set<String> filterByUniqueIdentifier (Set<String> clientStatusIdentifiers) {
        Set<String> uniqueIdentifiers = new Set<String>();
        for(Picklist_Values_Transition_Setting__mdt picklistMdt: [SELECT label, Unique_Identifier__c FROM Picklist_Values_Transition_Setting__mdt WHERE Unique_Identifier__c IN :clientStatusIdentifiers]){
            if(picklistMdt.Unique_Identifier__c != null){
                uniqueIdentifiers.add(picklistMdt.Unique_Identifier__c);
            }  
        }
        return uniqueIdentifiers;
    }    
}