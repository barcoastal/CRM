global class SObject2Apex {
    @testVisible
    private String recordTemplate;

    public SObject2Apex (Id recordId) {
        SObjectType sObjType = recordId.getSObjectType();
        String objectName = sObjType.getDescribe().getName();
        String objectLabel = sObjType.getDescribe().getLabel();
        SObject record = Database.query(buildQuery(sObjType) + ' WHERE Id = :recordId');
        List<String> copiable = new List<String>();
        Map<String, Schema.SObjectField> fieldMap = sObjType.getDescribe().fields.getMap();
        for (String field : fieldMap.keySet()) {
            Schema.DescribeFieldResult description = fieldMap.get(field).getDescribe();
            if (description.isCreateable() && description.isUpdateable()) {
                copiable.add(description.getName());
            }
        }
        this.recordTemplate = objectName + ' this'+objectLabel+' = new ' + objectName + '(';
        for (String fieldName : copiable) {
            String f = formatField(record.get(fieldName));
            if (f != null)
	            this.recordTemplate += fieldName + '=' + f + ', ';
        }
        this.recordTemplate = this.recordTemplate.removeEnd(', ');
        this.recordTemplate += ');';
        System.debug(this.recordTemplate);
    }

    public String getRecordTemplate() {
        return this.recordTemplate;
    }

    /**
     * Generates Apex code for child records of a given type related to a parent record
     * @param parentRecordId The ID of the parent record
     * @param childSObjectName The API name of the child SObject type (e.g., 'Opportunity', 'Contact')
     * @return A list of Apex code strings, one for each child record
     */
    public List<String> getChildRecordsTemplate(Id parentRecordId, String childSObjectName) {
        List<String> childTemplates = new List<String>();
        
        try {
            // Get the parent SObject type to determine the relationship
            SObjectType parentSObjectType = parentRecordId.getSObjectType();
            String parentObjectName = parentSObjectType.getDescribe().getName();
            
            // Get the child SObject type
            SObjectType childSObjectType = Schema.getGlobalDescribe().get(childSObjectName)?.getDescribe().getSObjectType();
            if (childSObjectType == null) {
                System.debug('ERROR: SObject type not found: ' + childSObjectName);
                return childTemplates;
            }
            
            // Find the parent-child relationship field (handles debug statements)
            String relationshipField = findRelationshipField(childSObjectType, parentSObjectType);
            if (relationshipField == null) {
                return childTemplates;
            }
            
            // Build and execute query for child records
            String childQuery = buildQuery(childSObjectType) + ' WHERE ' + relationshipField + ' = :parentRecordId';
            List<SObject> childRecords = Database.query(childQuery);
            
            if (childRecords.isEmpty()) {
                return childTemplates;
            }
            
            // Query parent record to generate its insert statement
            SObject parentRecord = Database.query(buildQuery(parentSObjectType) + ' WHERE Id = :parentRecordId');
            String parentTemplate = generateRecordTemplate(parentRecord, parentSObjectType);
            
            // Get child object label for variable naming
            String childObjectName = childSObjectType.getDescribe().getName();
            String childObjectLabel = childSObjectType.getDescribe().getLabel();
            String childListVar = generateListVariable(childObjectLabel);
            
            // Output parent insert
            System.debug('// Insert ' + parentObjectName);
            System.debug(parentTemplate);
            System.debug('insert this' + parentObjectName + ';');
            System.debug('');
            
            // Output child list declaration
            System.debug('// Insert ' + childObjectLabel);
            System.debug('List<' + childObjectName + '> ' + childListVar + ' = new List<' + childObjectName + '>();');
            System.debug('');
            
            // Generate template for each child record
            for (SObject childRecord : childRecords) {
                String childTemplate = generateChildTemplate(childRecord, childSObjectType, parentObjectName, childListVar);
                childTemplates.add(childTemplate);
                System.debug(childTemplate);
            }
            
            // Output insert statement
            System.debug('');
            System.debug('insert ' + childListVar + ';');
        } catch (Exception e) {
            System.debug('ERROR in getChildRecordsTemplate: ' + e.getMessage());
        }
        
        return childTemplates;
    }
    
    /**
     * Finds the relationship field that links a child SObject to its parent
     * @param childSObjectType The SObject type of the child
     * @param parentSObjectType The SObject type of the parent
     * @return The API name of the relationship field, or null if not found
     */
    @testVisible
    private String findRelationshipField(SObjectType childSObjectType, SObjectType parentSObjectType) {
        String parentObjectName = parentSObjectType.getDescribe().getName();
        String childObjectName = childSObjectType.getDescribe().getName();
        Map<String, Schema.SObjectField> fieldMap = childSObjectType.getDescribe().fields.getMap();
        
        // Look for lookup/master-detail fields that reference the parent object
        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
            
            // Check if this field is a reference to the parent object
            if (fieldDescribe.getType() == Schema.DisplayType.REFERENCE) {
                List<Schema.SObjectType> referencedTypes = fieldDescribe.getReferenceTo();
                for (Schema.SObjectType refType : referencedTypes) {
                    if (refType.getDescribe().getName() == parentObjectName) {
                        System.debug('Found relationship field: ' + fieldName + ' on ' + childObjectName + ' references ' + parentObjectName);
                        return fieldName;
                    }
                }
            }
        }
        
        System.debug('ERROR: No relationship found between ' + parentObjectName + ' and ' + childObjectName);
        return null;
    }
    
    /**
     * Generates an Apex code template for a single record
     * @param record The SObject record to generate code for
     * @param sObjType The SObject type of the record
     * @return The generated Apex code as a string
     */
    @testVisible
    private String generateRecordTemplate(SObject record, SObjectType sObjType) {
        String objectName = sObjType.getDescribe().getName();
        String objectLabel = sObjType.getDescribe().getLabel();
        List<String> copiable = new List<String>();
        Map<String, Schema.SObjectField> fieldMap = sObjType.getDescribe().fields.getMap();
        
        // Get createable and updateable fields
        for (String field : fieldMap.keySet()) {
            Schema.DescribeFieldResult description = fieldMap.get(field).getDescribe();
            if (description.isCreateable() && description.isUpdateable()) {
                copiable.add(description.getName());
            }
        }
        
        // Build the template string
        String template = objectName + ' this' + objectLabel + ' = new ' + objectName + '(';
        for (String fieldName : copiable) {
            String f = formatField(record.get(fieldName));
            if (f != null) {
                template += fieldName + '=' + f + ', ';
            }
        }
        template = template.removeEnd(', ');
        template += ');';
        
        return template;
    }
    
    /**
     * Generates a child record template formatted for list.add() with parent ID reference
     * @param record The SObject record to generate code for
     * @param sObjType The SObject type of the record
     * @param parentObjectName The API name of the parent object
     * @param listVarName The name of the list variable to add to
     * @return The generated Apex code as a string
     */
    @testVisible
    private String generateChildTemplate(SObject record, SObjectType sObjType, String parentObjectName, String listVarName) {
        String objectName = sObjType.getDescribe().getName();
        List<String> copiable = new List<String>();
        Map<String, Schema.SObjectField> fieldMap = sObjType.getDescribe().fields.getMap();
        
        // Get createable and updateable fields
        for (String field : fieldMap.keySet()) {
            Schema.DescribeFieldResult description = fieldMap.get(field).getDescribe();
            if (description.isCreateable() && description.isUpdateable()) {
                copiable.add(description.getName());
            }
        }
        
        // Build the template string with list.add() wrapper
        String template = listVarName + '.add(new ' + objectName + '(';
        for (String fieldName : copiable) {
            String f = formatField(record.get(fieldName));
            if (f != null) {
                // Replace hardcoded parent IDs with this<ParentObject>.Id reference
                if (fieldName.endsWith('Id') && (fieldName.endsWith('__c') || fieldName == 'AccountId' || fieldName == 'ParentId' || fieldName == 'OwnerId' == false)) {
                    // Check if this field references the parent object
                    String fieldValue = String.valueOf(record.get(fieldName));
                    if (fieldValue != null && fieldValue.length() == 15 || fieldValue.length() == 18) {
                        // This looks like an ID - check if it's the parent record ID
                        if (fieldName.containsIgnoreCase(parentObjectName) || (fieldName.endsWith('__c') && fieldName.containsIgnoreCase(parentObjectName.replace('__c', '')))) {
                            template += fieldName + '=this' + parentObjectName + '.Id, ';
                            continue;
                        }
                    }
                }
                template += fieldName + '=' + f + ', ';
            }
        }
        template = template.removeEnd(', ');
        template += '));';
        
        return template;
    }
    
    /**
     * Generates a camelCase variable name from an object label
     * @param objectLabel The label of the SObject (e.g., 'Five9 Call Log')
     * @return A camelCase variable name (e.g., 'callLogs')
     */
    @testVisible
    private String generateListVariable(String objectLabel) {
        // Remove spaces and special characters, convert to camelCase
        String[] words = objectLabel.split(' ');
        String varName = words[0].toLowerCase();
        for (Integer i = 1; i < words.size(); i++) {
            String word = words[i];
            varName += word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase();
        }
        return varName + 's';
    }
    
    @testVisible
    private String formatField (Object fieldValue) {
        if (fieldValue instanceof Date) {
            Date d = (Date) fieldValue;
            return String.format('Date.newInstance({0}, {1}, {2})', new List<String>{
                d.year()+'', d.month()+'', d.day()+''
            });
        } else if (fieldValue instanceof DateTime) {
            DateTime d = (DateTime) fieldValue;
            return String.format('DateTime.newInstance({0}, {1}, {2}, {3}, {4}, {5})', new List<String>{
                d.year()+'', d.month()+'', d.day()+'', d.hour()+'', d.minute()+'', d.second()+''
            });
        }
        if (fieldValue == null) {
            return null;
        }
        if (fieldValue instanceof Integer || fieldValue instanceof Decimal) {
            return String.valueOf(fieldValue);
        }
        return '\'' + String.valueOf(fieldValue) + '\'';
    }

    public static String buildQuery(SObjectType sObjType) {
        String obj_name = sObjType.getDescribe().getName();
        String query = 'SELECT ';
        for (String field : sObjType.getDescribe().fields.getMap().keySet()) {
            query += field + ', ';
        }
        query = query.removeEnd(', ');
        query += ' FROM ' + obj_name;
        return query;
    }

}