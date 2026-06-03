public inherited sharing class DMLService {
    
    public static List<Database.SaveResult> updateRecordsAsync(List<SObject> sObjectList) {
        return Database.update(
            sObjectList, //Update DML List
            false //All or None
        );
    }

    public static void performInsertDML(List<SObject> sObjectList, String scope) {
        if (!sObjectList.isEmpty()) {
            for (Database.SaveResult saveResult : Database.insert(sObjectList, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException(scope, saveResult.getId(), errorMessage, true);
                }
            }
        }
    }

    public static void performUpdateDML(List<SObject> sObjectList, String scope) {
        if (!sObjectList.isEmpty()) {
            for (Database.SaveResult saveResult : Database.update(sObjectList, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException(scope, saveResult.getId(), errorMessage, true);
                }
            }
        }
    }
    
    public static void performUpsertDML(List<SObject> sObjectList, String scope) {
        if (!sObjectList.isEmpty()) {
            for (Database.UpsertResult upsertResult : Database.upsert(sObjectList, false)) {
                if (!upsertResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : upsertResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException(scope, upsertResult.getId(), errorMessage, true);
                }
            }
        }
    }
}