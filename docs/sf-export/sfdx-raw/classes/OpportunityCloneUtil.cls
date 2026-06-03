public with sharing class OpportunityCloneUtil {
    
    public static sObjectSummary getSObjectSummary(String objectApiName) {
        DescribeSObjectResult describe = Schema.getGlobalDescribe().get(objectApiName).getDescribe();

        sObjectSummary summary = new sObjectSummary();
        summary.apiName = objectApiName;
        summary.label = describe.getLabel();
        summary.fields = new List<sObjectSummary.sFieldSummary>();

        Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
        Set<String> excluded = new Set<String>();

        for (Schema.SObjectField sf : fieldMap.values()) {
            Schema.DescribeFieldResult dfr = sf.getDescribe();
            sObjectSummary.sFieldSummary fieldSummary = new sObjectSummary.sFieldSummary(describe, dfr, excluded);
            summary.fields.add(fieldSummary);
        }
        return summary;
    }

    public static String getClonableFieldList(String objectApiName) {
        sObjectSummary summary = getSObjectSummary(objectApiName);
        List<String> fieldNames = new List<String>();

        for (sObjectSummary.sFieldSummary f : summary.fields) {
            if (f.isClonable) {
                fieldNames.add(f.apiName);
            }
        }
        return String.join(fieldNames, ',');
    }

    public static String buildParentChildQuery(
        String parentApiName, 
        Map<String, String> childApiToRelationship, 
        Id recordId
    ) {
        String parentFields = getClonableFieldList(parentApiName);
        
        List<String> childSubQueries = new List<String>();
        for (String childApiName : childApiToRelationship.keySet()) {
            String childFields = getClonableFieldList(childApiName);
            String relationshipName = childApiToRelationship.get(childApiName);
            
            childSubQueries.add('(SELECT ' + childFields + ' FROM ' + relationshipName + ')');
        }
        
        String query = 'SELECT ' + parentFields;
        if (!childSubQueries.isEmpty()) {
            query += ', ' + String.join(childSubQueries, ', ');
        }
        query += ' FROM ' + parentApiName + 
            ' WHERE Id = \'' + recordId + '\' LIMIT 1';
        
        return query;
    }
 

}