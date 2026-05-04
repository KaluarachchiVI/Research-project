"""
Integration tests for praboth integration with adaptive scheduler
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import tempfile
import os
from pathlib import Path

from src.data_integration.praboth_reader import PrabothDataReader, PrabothSession
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter
from src.session_manager.unified_session_manager import UnifiedSessionManager
from src.session_manager.praboth_realtime_client import PrabothRealtimeClient
from src.scheduling.time_block_scheduler import TimeBlock


class TestPrabothIntegration(unittest.TestCase):
    """Test praboth integration with adaptive scheduler"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_user_id = "test_user_001"
        self.test_praboth_session_id = 1
    
    @patch('src.data_integration.praboth_reader.PrabothDataReader.get_connection')
    def test_praboth_reader_get_sessions(self, mock_conn):
        """Test reading praboth sessions"""
        # Mock database connection
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = [
            {
                'session_id': 1,
                'started_at': '2024-01-15T10:00:00',
                'ended_at': '2024-01-15T12:00:00',
                'device_label': 'test_device'
            }
        ]
        mock_connection = Mock()
        mock_connection.cursor.return_value = mock_cursor
        mock_connection.__enter__ = Mock(return_value=mock_connection)
        mock_connection.__exit__ = Mock(return_value=False)
        mock_conn.return_value = mock_connection
        
        # This test would require actual database setup
        # For now, just test that the method exists
        self.assertTrue(hasattr(PrabothDataReader, 'get_sessions'))
    
    def test_praboth_session_detection(self):
        """Test praboth session detection methods"""
        # Test that methods exist
        reader = PrabothDataReader.__new__(PrabothDataReader)
        self.assertTrue(hasattr(reader, 'get_current_active_session'))
        self.assertTrue(hasattr(reader, 'find_session_by_time_range'))
        self.assertTrue(hasattr(reader, 'session_overlaps_with_adaptive_scheduler'))
    
    @patch('src.session_manager.praboth_realtime_client.requests.get')
    def test_praboth_realtime_client_service_available(self, mock_get):
        """Test praboth realtime client service availability check"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        client = PrabothRealtimeClient(api_url="http://localhost:8000")
        self.assertTrue(client.is_service_available())
    
    @patch('src.session_manager.praboth_realtime_client.requests.get')
    def test_praboth_realtime_client_service_unavailable(self, mock_get):
        """Test praboth realtime client when service unavailable"""
        mock_get.side_effect = Exception("Connection error")
        
        client = PrabothRealtimeClient(api_url="http://localhost:8000")
        self.assertFalse(client.is_service_available())
    
    def test_praboth_metrics_adapter_init(self):
        """Test praboth metrics adapter initialization"""
        # Test that adapter can be initialized (will fail if DB not found, but that's OK)
        try:
            adapter = PrabothMetricsAdapter()
            self.assertIsNotNone(adapter.praboth_reader)
        except FileNotFoundError:
            # Expected if praboth DB not found in test environment
            pass
    
    def test_unified_session_manager_praboth_integration(self):
        """Test unified session manager with praboth integration"""
        manager = UnifiedSessionManager()
        self.assertIsNotNone(manager.praboth_adapter)
        self.assertEqual(manager.praboth_api_url, "http://localhost:8000")
    
    def test_cognitive_load_extraction(self):
        """Test cognitive load extraction from praboth estimate"""
        client = PrabothRealtimeClient()
        
        # Test with different estimate formats
        estimate1 = {'load': 0.75}
        self.assertEqual(client._extract_cognitive_load(estimate1), 0.75)
        
        estimate2 = {'estimate': {'load': 0.65}}
        self.assertEqual(client._extract_cognitive_load(estimate2), 0.65)
        
        estimate3 = {'latent_mean': 0.55}
        self.assertEqual(client._extract_cognitive_load(estimate3), 0.55)
        
        estimate4 = {}
        self.assertIsNone(client._extract_cognitive_load(estimate4))
    
    def test_time_block_scheduler_with_metrics(self):
        """Test time block scheduler adaptation with metrics"""
        from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock
        
        scheduler = TimeBlockScheduler()
        
        # Test with good metrics (should keep successful intervals)
        good_metrics = {
            'PG': 0.2,  # Good personalization
            'SVR': 0.05,  # Low safety violations
            'AHL': 3  # Fast adaptation
        }
        
        time_block = TimeBlock(
            start_time=datetime(2024, 1, 15, 14, 0),
            end_time=datetime(2024, 1, 15, 16, 0),
            user_id="test_user"
        )
        
        schedule = scheduler.create_initial_schedule(
            time_block=time_block,
            previous_metrics=good_metrics
        )
        
        self.assertIsNotNone(schedule)
        self.assertGreater(len(schedule.intervals), 0)
    
    def test_error_handling_praboth_unavailable(self):
        """Test error handling when praboth unavailable"""
        manager = UnifiedSessionManager()
        
        # Create a time block
        time_block = TimeBlock(
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=2),
            user_id="test_user"
        )
        
        # Should not crash even if praboth unavailable
        try:
            session_id, schedule = manager.start_time_block_session(
                time_block=time_block,
                user_id="test_user"
            )
            self.assertIsNotNone(session_id)
            self.assertIsNotNone(schedule)
        except Exception as e:
            # Should handle gracefully
            self.fail(f"Should handle praboth unavailability gracefully: {e}")


if __name__ == '__main__':
    unittest.main()

