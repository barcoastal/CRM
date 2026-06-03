public without sharing class LookupService {
    
    private final static Integer MAX_RESULTS = 5;
    
    private static List<LookupSearchResult> wrapperResult(List<sObject> sObjectRecords, Searchable searcher){
        
        List<LookupSearchResult> results = new List<LookupSearchResult>();
        
        for(sObject obj : sObjectRecords){
            results.add(
                new LookupSearchResult(
                    (String)obj.get(searcher.valueApiName),
                    searcher.objectName,
                    searcher.iconNameOfObject,
                    (String)obj.get(searcher.labelApiName),
                    ''
                )
            );
        }
        return results;
    }
    
    @AuraEnabled
    public static List<LookupSearchResult> getRecords(String searchWrapperString) {
        try {
            Searchable searcher = (Searchable) JSON.deserialize(searchWrapperString, Searchable.class);
            List<List<SObject>> searchResults = new List<List<SObject>>();
            Set<String> searchablefields = new Set<String>();
            searchablefields.addAll(searcher.fields);
            String find = 'FIND \'' + String.escapeSingleQuotes(searcher.searchTerm) + '*\' IN ALL FIELDS';
            String returning = 'RETURNING ' + getReturning(searcher.objectName, searcher.fields);
            String limitter = 'LIMIT ' + MAX_RESULTS;
            String query = find + ' ' + returning + ' '+  limitter;
            searchResults = search.query(query);
            return wrapperResult(searchResults[0],searcher);
        } catch(Exception e) {
            //Handle exception
            throw new AuraHandledException(e.getMessage());
        }
    }
    @AuraEnabled
    public static List<LookupSearchResult> fetchLookUpValues(String searchWrapperString, String filterToQuery) {
        
        try {
            Searchable searcher = (Searchable) JSON.deserialize(searchWrapperString, Searchable.class);
            
            String searchKey = '%' + String.escapeSingleQuotes(searcher.searchTerm) + '%';
            
            List < sObject > returnList = new List < sObject > ();
            
            // Create a Dynamic SOQL Query For Fetch Record List with LIMIT 5   
            String sQuery =  'SELECT ' + String.join(searcher.fields, ', ') + ' FROM ' +searcher.objectName + ' WHERE Name LIKE: searchKey ';
            
            String filterQuery = String.isNotBlank(filterToQuery) ? filterToQuery : '';
            
            sQuery = sQuery  +   (String.isNotBlank(filterQuery) ?  ' AND ' + filterQuery :'') + ' WITH SECURITY_ENFORCED order by createdDate DESC LIMIT ' + MAX_RESULTS;
            List < sObject > lstOfRecords;
            lstOfRecords = Database.query(sQuery);           
            return wrapperResult(lstOfRecords,searcher);
            
        } catch(Exception e) {
            //Handle exception
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    private static String getReturning(String objectName, List<String> fields) {
        List<String> returning = new List<String>();
        String objectWithFields = objectName + (fields.isEmpty() ? '' : joinReturnFields(fields));
        returning.add(objectWithFields);
        return String.join(returning, ', ');
    }
    
    private static String joinReturnFields(List<String> fields) {
        return ' (' + String.escapeSingleQuotes(String.join(fields, ', ')) + ')';
    }
    
    public with sharing class Searchable {
        
        @AuraEnabled
        public String searchTerm;
        @AuraEnabled
        public String objectName;
        @AuraEnabled
        public List<String> fields;
        @AuraEnabled
        public String labelApiName;
        @AuraEnabled
        public String valueApiName;
        @AuraEnabled
        public String iconNameOfObject;
    } 
}