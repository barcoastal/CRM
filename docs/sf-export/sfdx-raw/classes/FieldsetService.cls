public inherited sharing class FieldsetService {

    @AuraEnabled(Cacheable=true)
    public static ApexActionResult describeFieldsetDetails(String sObjectName, String fieldsetName) {
        final String SCOPE = 'FieldsetService.describeFieldsetDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            ApexUtil.requireValue('SObject Name', sObjectName);
            ApexUtil.requireValue('Fieldset Name', fieldsetName);
            SObjectUtil sObjUtilInstance = ApexUtil.getDynamicSObjectUtilInstance(sObjectName);
            List<SObjectUtilHelper.FieldSetDetails> fieldsetDetailsList = sObjUtilInstance.getFieldsetDetails(fieldsetName);
            result.data = JSON.serialize(fieldsetDetailsList);
        } catch(Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
}