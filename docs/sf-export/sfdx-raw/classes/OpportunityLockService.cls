public inherited sharing class OpportunityLockService {

    private static final String ERROR_MSG = 'The updates are not allowed as the related Opportunity is locked.';
    private static final String ARCHIVED_ERROR_MSG = 'The updates are not allowed as the Opportunity is archived.';

    private static Boolean disableOppLock = false;
    
    public static void disableOppLockForSystemUpdates() {
        disableOppLock = true;
    }

    public static void reEnableOppLockAsSystemUpdatesDone() {
        disableOppLock = false;
    }

    public static void validateLockOpportunity(String parentFieldApiName, List<SObject> recordsToBlock, String errorMsg) {
    }
    
    public static void validateLockOpportunity(List<SObject> recordsToBlock, String parentFieldApiName) {
        if (!disableOppLock) {
            Set<Id> parentIds = getOppIds(recordsToBlock, parentFieldApiName);
            if (parentIds != null && !parentIds.isEmpty()) {
                Map<Id, Opportunity> lockedOppMap = new Map<Id, Opportunity>(getLockedOpportunities(parentIds));
                if (!lockedOppMap.isEmpty()) {
                    doValidation(recordsToBlock, lockedOppMap, parentFieldApiName);
                }
            }
        }
    }

    private static Set<Id> getOppIds(List<SObject> recordsToBlock, String parentFieldApiName) {
        Set<Id> parentIds = new Set<Id>();
        for (SObject record : recordsToBlock) {
            Id oppId = (Id)record.get(parentFieldApiName);
            if (oppId != null) {
                parentIds.add(oppId);
            }
        }
        return parentIds;
    }

    private static List<Opportunity> getLockedOpportunities(Set<Id> oppIds) {
        return [SELECT Id, Lock_Opportunity__c FROM Opportunity 
            WHERE Id IN :oppIds AND Lock_Opportunity__c = true
        ];
    }

    private static void doValidation(List<SObject> recordsToBlock, Map<Id, Opportunity> lockedOppMap, String parentFieldApiName) {
        for (SObject record : recordsToBlock) {
            Id oppId = (Id)record.get(parentFieldApiName);
            OpportunityUtil oppUtil = new OpportunityUtil();
            String opportunitySObjectName = oppUtil.getSObjName();
            Id recId = (Id)record.get('Id');

            if(recId != null && ApexUtil.getSObjectName(recId) == opportunitySObjectName
                && (String)record.get('StageName') == OpportunityUtil.STAGE_ARCHIVED) {
                record.addError(ARCHIVED_ERROR_MSG);
                break;
            }
            if (oppId != null && lockedOppMap.containsKey(oppId)) {
                record.addError(ERROR_MSG);
            }
        }
    }
}