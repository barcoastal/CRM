public inherited sharing class PicklistValueTransitionHelper {
    
    public static Map<String, Boolean> verifyPicklistTransition(Set<String> clientStatusIdentifier){     
        
        Map<String, Boolean> uniqueIdentifierMap = new Map<String, Boolean>();
        Set<String> uniqueidentifiers = PicklistValueTransitionMDT.filterByUniqueIdentifier(clientStatusIdentifier);
        for(String recIdentifier : clientStatusIdentifier){
            if(!uniqueIdentifierMap.containsKey(recIdentifier)){
                if(uniqueidentifiers.contains(recIdentifier)){
                    uniqueIdentifierMap.put(recIdentifier, true);
                }else{
                    uniqueIdentifierMap.put(recIdentifier, false);  
                }
            }
        }
        return uniqueIdentifierMap;        
    }
    
    public Static String generateAccountStatusUniqueIdentifer(String currentValue, String newValue){
        String objName = AccountUtil.getSObjectName();
        String fieldName = AccountUtil.FIELD_DISPOSITION;            
        String uniqueIdentifier = objName +'-'+ fieldName + '-';
        uniqueIdentifier += String.isNotBlank(currentValue)? currentValue+'-' : '<NA>-';
        uniqueIdentifier += String.isNotBlank(newValue) ? newValue : '<NA>';
        return uniqueIdentifier;
    }
        
    public static String generateUniqueIdentifier(String currentValue, String newValue, String objName, String fieldName){
        String uniqueIdentifier = objName +'-'+ fieldName + '-';
        uniqueIdentifier += String.isNotBlank(currentValue)? currentValue+'-' : '<NA>-';
        uniqueIdentifier += String.isNotBlank(newValue) ? newValue : '<NA>';
        return uniqueIdentifier;    
    }
}