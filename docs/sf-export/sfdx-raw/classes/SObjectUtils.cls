/**
 * Description:
 * Contains utililty methods for generically handling SObjects.
 
 */
public class SObjectUtils {

    /**
     * Returns a single SObject for a given object Id with all fields populated.
     */
    public static SObject getObject(Id objectId) {
        Map<Id, SObject> mapSObjects = SObjectUtils.getObjects(new List<Id> {objectId});
        return mapSObjects.get(objectId);
    }
    
    /**
     * Returns a Map of SObjects with all fields populated for the List of objectIds. This 
     * methods assumes the object Ids passed in are all for the same type of object.
     */
    public static Map<Id, SObject> getObjects(List<Id> objectIds) {
        
        // Making sure there are ids to query for.
        if (objectIds == null || objectIds.isEmpty()) {
            NullPointerException eNullPointer = new NullPointerException();
            eNullPointer.setMessage('The list of Object Ids cannot be null or empty');
            throw eNullPointer;
        }
        
        // Getting the Id of just the first Id in the list. All of the object Ids
        // must be of the same type, and we just need one to determine the type of
        // object (Schema.DescribeSObjectResult) we are working with.
        Id id = objectIds.get(0);
        Schema.DescribeSObjectResult describeSObject = id.getSObjectType().getDescribe();
        String objectName = describeSObject.name;
        
        // Build a list of all of the field names (API names) for the object.
        List<String> fieldNames = new List<String>();
        Map<String, Schema.SObjectField> fieldMap = describeSObject.fields.getMap();
        for(Schema.SObjectField sObjectField:fieldMap.values()) {
            fieldNames.add(sObjectField.getDescribe().getName());
        } 
        
        // Perform the query of the data 
        String query = 'SELECT ' + String.join(fieldNames, ', ');
        query += ' FROM ' + objectName;
        query += ' WHERE Id =: objectIds';
        List<sObject> sObjectList = Database.query(query);
        
        // Put the results in the Map that is returned.
        Map<Id, SObject> mapSObjects = new Map<Id, SObject>();
        for (SObject sObj : sObjectList){
            mapSObjects.put((Id) sObj.get('Id'), sObj);
        }
        
        return mapSObjects;
    }
    
    /**
     * Returns a single SObject for a given record name with all fields populated.
     */
    public static SObject getObjectByName(String objectName, String recordName) {
        Map<String, SObject> mapSObjects = SObjectUtils.getObjectsByName(objectName, new List<String> {recordName});
        return mapSObjects.get(recordName);
    }
    
     /**
     * Returns a Map of SObjects with all fields populated for a list of given object record names. Only 
     * one record will be returned for a given name even though records may exists with the same value 
     * in the 'Name' field.
     */
    public static Map<String, SObject> getObjectsByName(String objectName, List<String> listRecordNames) {
        Map<String, SObject> sObjectsMap = new Map<String, SObject>();
        
        if (objectName == null) {
            NullPointerException eNullPointer = new NullPointerException();
            eNullPointer.setMessage('Object Name cannot be null!');
            throw eNullPointer;
        }
        
        if (listRecordNames == null || listRecordNames.isEmpty()) {
           	NullPointerException eNullPointer = new NullPointerException();
          	eNullPointer.setMessage('The list of Record Names cannot be null or empty');
            throw eNullPointer; 
        }
            
        // Get the list of field name for the object.
        List<String> fieldNames = getFieldNamesForObject(objectName);
        
        // Perform the actual query and put the results in the Map that is returned.
        String query = 'SELECT ' + String.join(fieldNames, ', ');
        query += ' FROM ' + objectName;
        query += ' WHERE Name =: listRecordNames';
        List<sObject> sObjectList = Database.query(query);
        for (SObject sObj : sObjectList){
            sObjectsMap.put((String) sObj.get('Name'), sObj);
        }
        
        return sObjectsMap;
    } 
    
    /**
     * Returns the object prefix for a given object name.
     **/
    public static String getObjectKeyPrefixForObjectName(String objectName) {
        String keyPrefix = null;
        try {
        	Schema.SObjectType sot = Schema.getGlobalDescribe().get(objectName) ;
			Schema.DescribeSObjectResult dsor = sot.getDescribe() ;
            keyPrefix = dsor.getKeyPrefix();
        } catch (Exception e) {
            NullPointerException exc = new NullPointerException();
            exc.setMessage('Unable to get SObject information for object name ' + objectName);
            throw exc;
        }
		return keyPrefix; 
    } 
    
    /**
     * Returns a List of all field names (API names) for a given object name.
     **/
    public static List<String> getFieldNamesForObject(String objectName) {
        
        // Get the DescribeSObjectResult for the given object name.
        List<String> listObjectNames = new List<String> {objectName};
		List<Schema.DescribeSobjectResult> listSObjectResults;
        try {
            listSObjectResults = Schema.describeSObjects(new List<String> {objectName});
        } catch(Exception e) {
           // CustomException eNoDataFound = new CustomException('Unable to get SObject information for object name ' + objectName);
           //	throw eNoDataFound;
        }
        
        Schema.DescribeSObjectResult describeSObject = listSObjectResults.get(0);
        
        // Get the list of field name for the object and add to the List to return.
        List<String> fieldNames = new List<String>();
        Map<String, Schema.SObjectField> fieldMap = describeSObject.fields.getMap();
        for(Schema.SObjectField sObjectField:fieldMap.values()) {
            fieldNames.add(sObjectField.getDescribe().getName());
        } 
        
        return fieldNames;
    }

    /**
     * Returns a List of all 'Updateable' field names (API names) for a given object name.
     * This is a shameless copy of the getFieldNamesForObject() but with the isUpdateable() twist on it :)
     **/
    public static List<Schema.DescribeFieldResult> getUpdateableFieldNamesForObject(String objectName) {
        
        // Get the DescribeSObjectResult for the given object name.
        List<String> listObjectNames = new List<String> {objectName};
		List<Schema.DescribeSobjectResult> listSObjectResults;
        try {
            listSObjectResults = Schema.describeSObjects(new List<String> {objectName});
        } catch(Exception e) {
           // CustomException eNoDataFound = new CustomException('Unable to get SObject information for object name ' + objectName);
           //	throw eNoDataFound;
        }
        
        Schema.DescribeSObjectResult describeSObject = listSObjectResults.get(0);
        
        // Get the DescribeFieldResult thingee for each of the fields and add it to the return list.
        /* We are passing this whole ugly DescribeFieldResult back as the client may want to get some other stuff out of it :) Like the label :) */
        List<Schema.DescribeFieldResult> fields = new List<Schema.DescribeFieldResult>();
        Map<String, Schema.SObjectField> fieldMap = describeSObject.fields.getMap();
        for(Schema.SObjectField sObjectField:fieldMap.values()) {
            Schema.DescribeFieldResult fieldResult = sObjectField.getDescribe();
            if(fieldResult.isUpdateable()) {
                fields.add(fieldResult);
            }
        } 
        
        return fields;
    }

    
    /* Default way to copy fields from one SObject to another. Do NOT clobber a field that is 
     * already populated in the target :) 
	 **/
    public static void copyFields(SObject source, SObject target, Set<String> excludeFieldNames) {
        copyFields(source, target, false, excludeFieldNames);
    }
    

    /**
     * Default way to copy fields from one SObject to another. Do NOT clobber a field that is 
     * already populated in the target :) 
	 **/
    public static void copyFields(SObject source, SObject target) {
        copyFields(source,target, false, new Set<String>());
    }

        /**
     * And if I DO want to clobber, (or not !!) use this
     * already populated in the target :) 
	 **/
    public static void copyFields(SObject source, SObject target, Boolean clobberTarget) {
        copyFields(source,target, clobberTarget, new Set<String>());
    }
    
    /**
     *  Assuming we have SObjects of the same type, I would like to copy any populated fields
     * in the source object over to the target object. If a field is populated in the source AND target
     * the target will get clobbered ONLY if you say so.
     **/
    public static void copyFields(SObject source, SObject target, Boolean clobberTarget, Set<String> excludeFieldNames) {

        for(SObjectField aField :source.getSObjectType().getDescribe().fields.getMap().values()) {
            if (excludeFieldNames.contains(aField.getDescribe().getName())) {continue;}
            try {
                Object sourceField = source.get(aField);
                Object targetField = target.get(aField);
                if (sourceField != null) {
                    if (targetField == null || clobberTarget) {
                        target.put(aField, sourceField);
                    }
                }
            }catch (SObjectException ex) {
            }
        }

    }

    /* Is the Id an Opportunity? */
    public static Boolean isOpportunity(Id id) {
        return id.getSobjectType() == Schema.Opportunity.SObjectType;
    }
    
    /* Is the Id a Quote? */
    public static Boolean isQuote(Id id) {
        return id.getSobjectType() == Schema.Quote.SObjectType;
    }

    /* Is the Id a User? */
    public static Boolean isUser(Id id) {
        return id.getSobjectType() == Schema.User.SObjectType;
    }

    /**
     * Clear out (set to null) all the fields specified in the list for the specified object
     **/
    public static void setToNull(SObject target, List<String> fieldNames) {

        for (String oneFieldName : fieldNames) {
            target.put(oneFieldName, null);
        }
    }

    /**
     * Return a fields (<Schema.DescribeFieldResult>) that have a different value between newObj and oldObj.   
     * We'll want to let the caller go and get the editableFields for us, as we dont want to determine that each time we call this.      
     */
    public static List<Schema.DescribeFieldResult> getChangedFields(List<Schema.DescribeFieldResult> editableFields, Set<String> ignoreFieldNames, SObject newObj, SObject oldObj) {

        /* Any changes we detect, we'll put the corresponding DescribeFieldResult in here */
        List<Schema.DescribeFieldResult> changedFields = new List<Schema.DescribeFieldResult>();
        
        /* Loop through all the editable fields we were given */
        for (Schema.DescribeFieldResult oneField : editableFields) {
            /* If we are dealing with a field we should ignore, well then, ignore it */
            if (ignoreFieldNames.contains(oneField.getName())) {continue;}
        
            /* Here, we want to do the 'simple' comparison between old and new values, but things went totally sideways
            for 'TextArea' fields ! We have to 'preprocess' these fields BEFORE we do a comparison to avoid false positives. 
       
            'TextArea' could have changes in cr/lf characters that are not really changes :( 
            So we need to pickout 'textarea' type fields and zap all those cr lf things before we do a comparison */
       
            if (oneField.getType() == DisplayType.TextArea) {
                
                /* What a mess but I need to do this in stages incase this is a null */
                String newVal = ((String) newObj.get(oneField.getName()));
                if (newVal != null) {
                    newVal = newVal.replaceAll('\r\n|\n|\r',' ');
                }

                String oldVal = ((String) oldObj.get(oneField.getName()));
                if (oldVal != null) {
                    oldVal = oldVal.replaceAll('\r\n|\n|\r',' ');
                }
                /* Now I can compare .... I think ... :(  */
                if (newVal == oldVal) {continue;}
            }
            /* This is not a text area, so hopefully this comparision will suffice */
            else if (newObj.get(oneField.getName()) == oldObj.get(oneField.getName())) {continue;}
        
            /* Ouch, the only reason I got here is the field is not to be ignored, AND it's different so */
            changedFields.add(oneField);
            
        } 
        /* Whatever is in this list, return it to the caller */
        return changedFields;
    }

    /* If you have an SObject (that you just got out of the database or something like that!) we can turn that
    into a generic 'vm' like structure that is easily consumable by LWC.    
    You'd use this to create the 'base' vm and then go and add whatever other attributes you like
    The reason we simply cant use getPopulatedFieldsAsMap() and return that map, is that it returns a RO map, so we're stuffed,
    so make our own copy please */
    
    public static Map<String,Object> adaptToVm(SObject oneDbResult) {

        /* Start with all the Populated fields in the SObject */
        Map<String,Object> populatedFields = oneDbResult.getPopulatedFieldsAsMap();

        /* Create an empty generic 'vm' */
        Map<String, Object> vmForOneResult = new Map<String, Object>();

        /* and copy them over please */
        for (String fieldName : populatedFields.keySet()) {
            vmForOneResult.put(fieldName, populatedFields.get(fieldName));
        }

        return vmForOneResult;
    }

    /**
     * Compare two maps of SObject, 
     * and returns a new map with the elements that are uncommon for both maps.
     */
    public static Map<String, SObject> createMapWithUncommonElements(Map<String, SObject> firstMap, Map<String, SObject> secondMap){

        // Create two clone maps
        Map<String, SObject> firstMapClone = firstMap.clone();
        Map<String, SObject> secondMapClone = secondMap.clone();
  
        // Remove common elements
        Set<String> temporaryKeySet = firstMapClone.keyset().clone();
        firstMapClone.keyset().removeAll(secondMapClone.keySet());
        secondMapClone.keySet().removeAll(temporaryKeySet);
        
        // Populate result map
        Map<String, SObject> resultMap = new Map<String, SObject>();
        resultMap.putAll(firstMapClone);
        resultMap.putAll(secondMapClone);
  
        return resultMap;
      }
}